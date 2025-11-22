from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth.models import User
from .models import Plant
from .serializers import UserSerializer, PlantSerializer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets, permissions
from .models import Plant
from .serializers import PlantSerializer
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone


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

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar": avatar,
        })

   




class PlantViewSet(viewsets.ModelViewSet):
    queryset = Plant.objects.all() 
    serializer_class = PlantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only return plants for the logged-in user
        return Plant.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Assign the current user before saving
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
