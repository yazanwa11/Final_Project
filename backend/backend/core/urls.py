from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from django.conf import settings
from django.conf.urls.static import static

from .views import RegisterView, UserMeView, PlantViewSet
from . import views

from .views import (
    list_notifications,
    mark_notification_read,
    mark_all_notifications_read,   # ✅ NEW

    list_expert_posts,
    create_expert_post,

    ask_expert,                    # ✅ NEW
    expert_inbox,                  # ✅ NEW
    answer_inquiry,                # ✅ NEW
)

router = DefaultRouter()
router.register("plants", PlantViewSet, basename="plants")

urlpatterns = [
    # -------------------------
    # Auth / Users
    # -------------------------
    path("users/register/", RegisterView.as_view(), name="register"),
    path("users/login/", TokenObtainPairView.as_view(), name="login"),
    path("users/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("users/me/", UserMeView.as_view(), name="user-me"),
    path("users/update/", views.update_user, name="update_user"),

    # -------------------------
    # Plant Logs / Reminders
    # -------------------------
    path("plants/<int:plant_id>/logs/", views.get_care_logs),
    path("plants/<int:plant_id>/logs/add/", views.add_care_log),
    path("logs/<int:log_id>/delete/", views.delete_care_log),
    path("plants/<int:plant_id>/reminders/", views.update_reminders),

    # -------------------------
    # Suggested Plants
    # -------------------------
    path("plants/suggestions/", views.plant_suggestions),
    path("plants/add-suggested/", views.add_suggested_plant),

    # -------------------------
    # Notifications
    # -------------------------
    path("notifications/", list_notifications),
    path("notifications/<int:notif_id>/read/", mark_notification_read),
    path("notifications/read-all/", mark_all_notifications_read),  # ✅ NEW

    # -------------------------
    # Explore: Expert Posts
    # -------------------------
    path("explore/posts/", list_expert_posts),
    path("explore/posts/create/", create_expert_post),

    # -------------------------
    # Explore: Ask Expert + Inbox + Answer
    # -------------------------
    path("explore/ask/", ask_expert),  # user creates inquiry
    path("explore/inbox/", expert_inbox),  # experts see open inquiries
    path("explore/inquiries/<int:inquiry_id>/answer/", answer_inquiry),  # expert answers

    # -------------------------
    # Plants CRUD (ViewSet)
    # -------------------------
    path("", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
