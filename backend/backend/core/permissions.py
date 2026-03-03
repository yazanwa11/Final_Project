from rest_framework.permissions import BasePermission

class IsExpert(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and hasattr(user, "profile")
            and user.profile.role in ("expert", "admin")
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
