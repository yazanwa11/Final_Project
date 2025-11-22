from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, UserMeView
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlantViewSet
from . import views  

router = DefaultRouter()
router.register('plants', PlantViewSet, basename='plants')

urlpatterns = [
    # Auth
    path("users/register/", RegisterView.as_view(), name="register"),
    path("users/login/", TokenObtainPairView.as_view(), name="login"),
    path("users/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("users/me/", UserMeView.as_view(), name="user-me"),  # ✅ new
    path('users/update/', views.update_user, name='update_user'),
    path("plants/<int:plant_id>/logs/", views.get_care_logs),
    path("plants/<int:plant_id>/logs/add/", views.add_care_log),
    path("logs/<int:log_id>/delete/", views.delete_care_log),
    path("plants/<int:plant_id>/reminders/", views.update_reminders),

    # Plants
    path('', include(router.urls)),
]
