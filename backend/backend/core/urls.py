from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from django.conf import settings
from django.conf.urls.static import static

from .views import RegisterView, UserMeView, PlantViewSet, CustomTokenObtainPairView
from . import views
from . import weather_views
from . import places_views
from . import assistant_views

from .views import (
    list_notifications,
    mark_notification_read,
    mark_all_notifications_read,   # ✅ NEW

    list_expert_posts,
    create_expert_post,

    ask_expert,                    # ✅ NEW
    expert_inbox,                  # ✅ NEW
    answer_inquiry,                # ✅ NEW
    admin_users_list,
    admin_pending_experts,
    admin_user_update,
    admin_user_delete,
    admin_review_expert,
    list_community_posts,
    create_community_post,
    update_community_post,
    delete_community_post,
    toggle_community_post_like,
    create_prediction,
    prediction_detail,
    prediction_list,
    plant_health_score,
    plant_health_history,
    recompute_plant_health,
    get_growth_journal,
    add_growth_journal_entry,
    delete_growth_journal_entry,
    create_growth_timelapse,
)

router = DefaultRouter()
router.register("plants", PlantViewSet, basename="plants")

urlpatterns = [
    # -------------------------
    # Auth / Users
    # -------------------------
    path("users/register/", RegisterView.as_view(), name="register"),
    path("users/login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("users/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("users/me/", UserMeView.as_view(), name="user-me"),
    path("users/update/", views.update_user, name="update_user"),

    # -------------------------
    # Admin Dashboard
    # -------------------------
    path("admin/users/", admin_users_list),
    path("admin/users/<int:user_id>/update/", admin_user_update),
    path("admin/users/<int:user_id>/delete/", admin_user_delete),
    path("admin/experts/pending/", admin_pending_experts),
    path("admin/experts/<int:user_id>/review/", admin_review_expert),

    # -------------------------
    # Plant Logs / Reminders
    # -------------------------
    path("plants/<int:plant_id>/logs/", views.get_care_logs),
    path("plants/<int:plant_id>/logs/add/", views.add_care_log),
    path("logs/<int:log_id>/delete/", views.delete_care_log),
    path("plants/<int:plant_id>/reminders/", views.update_reminders),
    path("plants/<int:plant_id>/growth-journal/", get_growth_journal),
    path("plants/<int:plant_id>/growth-journal/add/", add_growth_journal_entry),
    path("plants/growth-journal/<int:entry_id>/delete/", delete_growth_journal_entry),
    path("plants/<int:plant_id>/growth-journal/timelapse/", create_growth_timelapse),

    # -------------------------
    # Suggested Plants
    # -------------------------
    path("plants/suggestions/", views.plant_suggestions),
    path("plants/add-suggested/", views.add_suggested_plant),
    path("plants/identify/", views.identify_plant_from_image),

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
    # Community Feed (all users)
    # -------------------------
    path("feed/posts/", list_community_posts),
    path("feed/posts/create/", create_community_post),
    path("feed/posts/<int:post_id>/update/", update_community_post),
    path("feed/posts/<int:post_id>/delete/", delete_community_post),
    path("feed/posts/<int:post_id>/toggle-like/", toggle_community_post_like),

    # -------------------------
    # Plants CRUD (ViewSet)
    # -------------------------
    path("predictions/", prediction_list),
    path("predictions/create/", create_prediction),
    path("predictions/<uuid:prediction_id>/", prediction_detail),
    path("plants/<int:plant_id>/health-score/", plant_health_score),
    path("plants/<int:plant_id>/health-history/", plant_health_history),
    path("plants/<int:plant_id>/health-score/recompute/", recompute_plant_health),

    # -------------------------
    # Smart Weather Reminders
    # -------------------------
    path("weather/evaluate/", weather_views.trigger_weather_evaluation),
    path("weather/plants/<int:plant_id>/sync/", weather_views.trigger_weather_sync_for_plant),
    path("weather/plants/<int:plant_id>/status/", weather_views.plant_weather_status),
    path("weather/forecast/", weather_views.get_forecast),

    # -------------------------
    # Nearby Nurseries
    # -------------------------
    path("places/nurseries/", places_views.nearby_nurseries),

    # -------------------------
    # AI Assistant
    # -------------------------
    path("assistant/chat/", assistant_views.assistant_chat),
    path("assistant/sessions/", assistant_views.assistant_sessions),
    path("assistant/sessions/<uuid:session_id>/messages/", assistant_views.assistant_session_messages),

    path("", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
