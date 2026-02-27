from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from .models import Plant, Notification, ExpertPost, ExpertInquiry, Prediction, DiseaseProfile, PlantHealthSnapshot
from .serializers import (
    UserSerializer,
    PlantSerializer,
    NotificationSerializer,
    ExpertPostSerializer,
    ExpertInquirySerializer,
    PredictionCreateSerializer,
    PredictionSerializer,
    PlantHealthSnapshotSerializer,
)
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets, permissions
from .serializers import PlantSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
import requests
import re
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .permissions import IsExpert
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .inference import InferenceService, DEFAULT_DISEASES
from .health_scoring import compute_and_store_plant_health



# --- Auth / Users ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]



class UserMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        avatar = None
        if hasattr(user, "profile") and user.profile.avatar:
            avatar = request.build_absolute_uri(user.profile.avatar.url)

        role = "user"
        if hasattr(user, "profile") and getattr(user.profile, "role", None):
            role = user.profile.role

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar": avatar,
            "role": role,
        })


   




class PlantViewSet(viewsets.ModelViewSet):
    serializer_class = PlantSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Plant.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user(request):
    user = request.user

    user.username = request.data.get('username', user.username)
    user.email = request.data.get('email', user.email)

    # ✅ handle avatar upload properly
    if 'avatar' in request.FILES:
        user.profile.avatar = request.FILES['avatar']
        user.profile.save()

    user.save()

    return Response({
        "message": "Profile updated successfully 🌿",
        "username": user.username,
        "email": user.email,
        "avatar": request.build_absolute_uri(user.profile.avatar.url)
        if user.profile.avatar else None,
    }, status=status.HTTP_200_OK)



from .models import CareLog
from .serializers import CareLogSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_care_logs(request, plant_id):
    logs = CareLog.objects.filter(user=request.user, plant_id=plant_id).order_by("-date")
    serializer = CareLogSerializer(logs, many=True, context={"request": request})
    return Response(serializer.data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_care_log(request, plant_id):
    data = request.data.copy()
    data["plant"] = plant_id

    serializer = CareLogSerializer(data=data, context={"request": request})
    if serializer.is_valid():
        log = serializer.save(user=request.user, plant_id=plant_id)

        # --- 🌱 Update reminder dates automatically ---
        try:
            plant = Plant.objects.get(id=plant_id, user=request.user)

            if log.action.lower() == "watered":
                plant.last_watered = timezone.now()

            if log.action.lower() == "sunlight":
                plant.last_sunlight = timezone.now()

            plant.save()
        except Plant.DoesNotExist:
            pass

        return Response(serializer.data, status=201)

    return Response(serializer.errors, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_care_log(request, log_id):
    try:
        log = CareLog.objects.get(id=log_id, user=request.user)
        log.delete()
        return Response({"message": "Deleted"}, status=200)
    except CareLog.DoesNotExist:
        return Response({"error": "Not found"}, status=404)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_reminders(request, plant_id):
    try:
        plant = Plant.objects.get(id=plant_id, user=request.user)
    except Plant.DoesNotExist:
        return Response({"error": "Plant not found"}, status=404)

    watering = request.data.get("watering_interval")
    sunlight = request.data.get("sunlight_interval")

    if watering is not None:
        plant.watering_interval = watering
    if sunlight is not None:
        plant.sunlight_interval = sunlight

    plant.save()

    return Response({
        "message": "Reminders updated",
        "watering_interval": plant.watering_interval,
        "sunlight_interval": plant.sunlight_interval
    })


def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def sunlight_days_from_light(light_val):
    """
    Trefle growth.light is typically 0-10 (higher = more light need).
    Convert to an interval in days for your app UI.
    """
    if light_val is None:
        return 2
    light_val = clamp(int(light_val), 0, 10)

    # more light need -> more frequent sunlight exposure
    if light_val >= 8:
        return 1
    if light_val >= 5:
        return 2
    return 3

def watering_days_from_humidity(humidity_val):
    """
    Trefle growth.atmospheric_humidity is typically 0-10 (higher = likes humidity).
    Convert to an interval in days for watering in your app UI.
    """
    if humidity_val is None:
        return 5
    humidity_val = clamp(int(humidity_val), 0, 10)

    # higher humidity preference -> generally water more often
    # (API-based numeric -> mapped to days)
    days = round(14 - humidity_val * 1.2)  # 10 -> ~2 days, 0 -> 14 days
    return clamp(days, 2, 14)

def to_int(v):
    try:
        if v is None:
            return None
        return int(v)
    except (TypeError, ValueError):
        return None


def local_plant_suggestions(query: str):
    base = [
        {"id": 9001, "name": "Basil", "category": "Herb", "watering_interval": 2, "sunlight_interval": 1, "image": None},
        {"id": 9002, "name": "Mint", "category": "Herb", "watering_interval": 3, "sunlight_interval": 2, "image": None},
        {"id": 9003, "name": "Rosemary", "category": "Herb", "watering_interval": 4, "sunlight_interval": 1, "image": None},
        {"id": 9004, "name": "Tomato", "category": "Vegetable", "watering_interval": 2, "sunlight_interval": 1, "image": None},
        {"id": 9005, "name": "Cucumber", "category": "Vegetable", "watering_interval": 2, "sunlight_interval": 1, "image": None},
        {"id": 9006, "name": "Lavender", "category": "Flower", "watering_interval": 5, "sunlight_interval": 1, "image": None},
        {"id": 9007, "name": "Snake Plant", "category": "Indoor", "watering_interval": 10, "sunlight_interval": 3, "image": None},
        {"id": 9008, "name": "Peace Lily", "category": "Indoor", "watering_interval": 5, "sunlight_interval": 2, "image": None},
    ]

    q = (query or "").strip().lower()
    if not q:
        return base
    return [item for item in base if q in item["name"].lower() or q in item["category"].lower()]


def parse_days_from_text(value: str | None, default_value: int = 4) -> int:
    if not value:
        return default_value
    nums = re.findall(r"\d+", str(value))
    if not nums:
        return default_value
    values = [int(num) for num in nums]
    avg = round(sum(values) / len(values))
    return max(1, min(14, avg))


def is_provider_placeholder(value: str | None) -> bool:
    if not value:
        return False
    text = str(value).lower()
    return "upgrade plans" in text or "subscription-api-pricing" in text


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def plant_suggestions(request):
    query = request.GET.get("q") or "plant"
    token = getattr(settings, "PERENUAL_API_KEY", None)

    if not token:
        return Response(local_plant_suggestions(query))

    search_url = "https://perenual.com/api/species-list"
    try:
        sr = requests.get(search_url, params={"key": token, "q": query, "page": 1}, timeout=12)
        if sr.status_code != 200:
            return Response(local_plant_suggestions(query))
        search_payload = sr.json()
    except Exception:
        return Response(local_plant_suggestions(query))

    items = (search_payload.get("data") or [])[:10]

    results = []
    for p in items:
        plant_id = p.get("id")
        if not plant_id:
            continue

        detail_url = f"https://perenual.com/api/species/details/{plant_id}"
        try:
            dr = requests.get(detail_url, params={"key": token}, timeout=12)
            if dr.status_code != 200:
                continue
            detail_payload = dr.json()
        except Exception:
            continue

        d = detail_payload if isinstance(detail_payload, dict) else {}
        name = d.get("common_name") or p.get("common_name") or (p.get("scientific_name") or ["Unknown"])[0]
        default_image = d.get("default_image") or p.get("default_image") or {}
        image_url = default_image.get("original_url") or default_image.get("regular_url")

        water_text = None
        benchmark = d.get("watering_general_benchmark") or {}
        if isinstance(benchmark, dict):
            water_text = benchmark.get("value")
        if not water_text:
            water_text = d.get("watering")
        if is_provider_placeholder(water_text):
            water_text = None

        sunlight_value = d.get("sunlight")
        if isinstance(sunlight_value, list):
            sunlight_text = " ".join(str(item) for item in sunlight_value)
        else:
            sunlight_text = str(sunlight_value or "")
        if is_provider_placeholder(sunlight_text):
            sunlight_text = ""

        watering_interval = parse_days_from_text(water_text, default_value=4)
        sunlight_interval = 1 if "full" in sunlight_text.lower() else 2
        category = p.get("cycle") or "General"
        if is_provider_placeholder(category):
            category = "General"

        results.append({
            "id": plant_id,
            "name": name,
            "category": category,
            "watering_interval": watering_interval,
            "sunlight_interval": sunlight_interval,
            "image": image_url,
        })

    if not results:
        return Response(local_plant_suggestions(query))

    return Response(results)




@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_suggested_plant(request):
    data = request.data
    name = (data.get("name") or "").strip()

    if not name:
        return Response({"detail": "Missing plant name"}, status=status.HTTP_400_BAD_REQUEST)

    if Plant.objects.filter(user=request.user, name__iexact=name).exists():
        return Response({"detail": "Plant with this name already exists"}, status=status.HTTP_409_CONFLICT)

    # ✅ take image from the suggested payload
    img = (data.get("image") or data.get("image_url") or "").strip() or None

    plant = Plant.objects.create(
        user=request.user,
        name=name,
        category=data.get("category", "General"),
        watering_interval=data.get("watering_interval") or 3,
        sunlight_interval=data.get("sunlight_interval") or 2,
        planting_date=timezone.now().date(),
        image_url=img,  # ✅ THIS is the important line
    )

    return Response({"status": "created", "plant_id": plant.id}, status=status.HTTP_201_CREATED)




@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    qs = Notification.objects.filter(user=request.user)
    return Response(NotificationSerializer(qs, many=True).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notif_id):
    try:
        n = Notification.objects.get(id=notif_id, user=request.user)
        n.is_read = True
        n.save(update_fields=["is_read"])
        return Response({"status": "ok"})
    except Notification.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)
    

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_expert_posts(request):
    posts = ExpertPost.objects.all()
    return Response(ExpertPostSerializer(posts, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def plant_health_score(request, plant_id: int):
    try:
        plant = Plant.objects.get(id=plant_id, user=request.user)
    except Plant.DoesNotExist:
        return Response({"detail": "Plant not found"}, status=404)

    snapshot = plant.health_snapshots.order_by("-created_at").first()
    if snapshot is None or request.GET.get("recompute") == "1":
        snapshot = compute_and_store_plant_health(plant, window_days=30)

    return Response(PlantHealthSnapshotSerializer(snapshot).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def plant_health_history(request, plant_id: int):
    try:
        plant = Plant.objects.get(id=plant_id, user=request.user)
    except Plant.DoesNotExist:
        return Response({"detail": "Plant not found"}, status=404)

    days = int(request.GET.get("days", 90))
    since = timezone.now() - timedelta(days=days)
    snapshots = PlantHealthSnapshot.objects.filter(plant=plant, created_at__gte=since).order_by("created_at")
    return Response(PlantHealthSnapshotSerializer(snapshots, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def recompute_plant_health(request, plant_id: int):
    try:
        plant = Plant.objects.get(id=plant_id, user=request.user)
    except Plant.DoesNotExist:
        return Response({"detail": "Plant not found"}, status=404)

    snapshot = compute_and_store_plant_health(plant, window_days=30)
    return Response(PlantHealthSnapshotSerializer(snapshot).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_prediction(request):
    serializer = PredictionCreateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    prediction = serializer.save(status="pending")
    language = request.data.get("language", "he")  # Default to Hebrew

    try:
        result = InferenceService.predict(prediction.image.path, language=language)
        disease = DiseaseProfile.objects.filter(code=result["disease_code"]).first()
        if disease is None:
            defaults = DEFAULT_DISEASES.get(result["disease_code"], {})
            disease = DiseaseProfile.objects.create(
                code=result["disease_code"],
                display_name=result["disease_name"],
                treatment_recommendation=defaults.get("treatment", result["treatment_recommendation"]),
                urgency_level=defaults.get("urgency", result["urgency_level"]),
                is_active=True,
            )

        prediction.status = "done"
        prediction.disease = disease
        prediction.confidence_score = result["confidence_score"]
        prediction.treatment_recommendation = result["treatment_recommendation"]
        prediction.urgency_level = result["urgency_level"]
        prediction.model_version = result["model_version"]
        prediction.raw_topk = result["raw_topk"]
        prediction.completed_at = timezone.now()
        prediction.failure_reason = ""
        prediction.save(
            update_fields=[
                "status",
                "disease",
                "confidence_score",
                "treatment_recommendation",
                "urgency_level",
                "model_version",
                "raw_topk",
                "completed_at",
                "failure_reason",
            ]
        )
    except Exception as exc:
        prediction.status = "failed"
        prediction.failure_reason = str(exc)
        prediction.completed_at = timezone.now()
        prediction.save(update_fields=["status", "failure_reason", "completed_at"])

    return Response(
        PredictionSerializer(prediction, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def prediction_detail(request, prediction_id):
    try:
        prediction = Prediction.objects.get(id=prediction_id, user=request.user)
    except Prediction.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    return Response(PredictionSerializer(prediction, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def prediction_list(request):
    queryset = Prediction.objects.filter(user=request.user)
    plant_id = request.GET.get("plant_id")

    if plant_id:
        queryset = queryset.filter(plant_id=plant_id)

    queryset = queryset.order_by("-created_at")[:50]
    return Response(PredictionSerializer(queryset, many=True, context={"request": request}).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsExpert])
def create_expert_post(request):
    s = ExpertPostSerializer(data=request.data, context={"request": request})
    if not s.is_valid():
        return Response(s.errors, status=400)

    post = ExpertPost.objects.create(
        author=request.user,
        title=s.validated_data["title"],
        content=s.validated_data["content"],
        image_url=s.validated_data.get("image_url"),
    )

    # create notifications for normal users (you can expand later: followers)
    users = User.objects.filter(profile__role="user")
    Notification.objects.bulk_create([
        Notification(
            user=u,
            type="new_expert_post",
            title="New expert tip 🌿",
            body=post.title,
            data={"post_id": post.id},
        )
        for u in users
    ])

    return Response(ExpertPostSerializer(post, context={"request": request}).data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ask_expert(request):
    plant_name = (request.data.get("plant_name") or "").strip()
    question = (request.data.get("question") or "").strip()

    if not question:
        return Response({"detail": "question is required"}, status=400)

    inquiry = ExpertInquiry.objects.create(
        user=request.user,
        plant_name=plant_name,
        question=question,
        status="open",
    )

    # notify experts
    experts = User.objects.filter(profile__role__in=["expert", "admin"])
    Notification.objects.bulk_create([
        Notification(
            user=e,
            type="system",
            title="New question from a user 💬",
            body=(f"{plant_name + ' - ' if plant_name else ''}{question}")[:180],
            data={"inquiry_id": inquiry.id},
        )
        for e in experts
    ])

    return Response({"status": "created", "inquiry_id": inquiry.id}, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsExpert])
def expert_inbox(request):
    qs = ExpertInquiry.objects.filter(status="open")
    return Response(ExpertInquirySerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsExpert])
def answer_inquiry(request, inquiry_id: int):
    answer = (request.data.get("answer") or "").strip()
    if not answer:
        return Response({"detail": "answer is required"}, status=400)

    try:
        inquiry = ExpertInquiry.objects.get(id=inquiry_id)
    except ExpertInquiry.DoesNotExist:
        return Response({"detail": "Not found"}, status=404)

    if inquiry.status == "answered":
        return Response({"detail": "Already answered"}, status=409)

    inquiry.status = "answered"
    inquiry.answer = answer
    inquiry.answered_by = request.user
    inquiry.answered_at = timezone.now()
    inquiry.save()

    # notify user who asked
    Notification.objects.create(
        user=inquiry.user,
        type="expert_reply",
        title="Expert replied 🌿",
        body=answer[:180],
        data={"inquiry_id": inquiry.id},
    )

    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({"status": "ok"})


from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ExpertPost
from .serializers import ExpertPostSerializer
from django.db.models import Q



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_expert_posts(request):
    q = (request.GET.get("q") or "").strip()

    posts = ExpertPost.objects.all().order_by("-created_at")

    if q:
        posts = posts.filter(
            Q(title__icontains=q) |
            Q(content__icontains=q)
        )

    return Response(ExpertPostSerializer(posts, many=True, context={"request": request}).data)

