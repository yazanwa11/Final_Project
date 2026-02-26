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
