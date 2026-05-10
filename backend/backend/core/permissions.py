from rest_framework.permissions import BasePermission

class IsExpert(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not hasattr(user, "profile"):
            return False

        profile = user.profile
        if profile.role == "admin":
            return True

        return bool(
            profile.role == "expert"
            and profile.expert_approval_status == "approved"
        )


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_staff or user.is_superuser:
            return True

        return bool(
            hasattr(user, "profile")
            and user.profile.role == "admin"
        )
