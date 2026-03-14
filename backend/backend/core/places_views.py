from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .places_service import GooglePlacesClient


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def nearby_nurseries(request):
    latitude_raw = request.GET.get("latitude")
    longitude_raw = request.GET.get("longitude")
    keyword = request.GET.get("keyword", "משתלה")
    limit_raw = request.GET.get("limit", "12")

    if latitude_raw is None or longitude_raw is None:
        return Response({"detail": "latitude and longitude are required"}, status=400)

    try:
        latitude = float(latitude_raw)
        longitude = float(longitude_raw)
    except (TypeError, ValueError):
        return Response({"detail": "Invalid latitude/longitude"}, status=400)

    try:
        limit = int(limit_raw)
    except (TypeError, ValueError):
        limit = 12

    try:
        items = GooglePlacesClient.list_nearby_nurseries(
            user_latitude=latitude,
            user_longitude=longitude,
            keyword=keyword,
            limit=limit,
        )
        return Response(
            {
                "latitude": latitude,
                "longitude": longitude,
                "keyword": keyword,
                "count": len(items),
                "results": items,
            }
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=503)
    except Exception as exc:
        return Response({"detail": str(exc)}, status=500)
