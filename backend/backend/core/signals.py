from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.db.models.signals import post_migrate
from .models import Profile

@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    # create profile for new users, and also ensure it exists for old users
    Profile.objects.get_or_create(user=instance)


@receiver(post_migrate)
def ensure_default_admin(sender, **kwargs):
    if getattr(sender, "name", "") != "core":
        return

    admin_user, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@greenbuddy.local",
            "is_staff": True,
            "is_superuser": True,
        },
    )

    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.set_password("admin")
    admin_user.save(update_fields=["is_staff", "is_superuser", "password"])

    profile, _ = Profile.objects.get_or_create(user=admin_user)
    profile.role = "admin"
    profile.expert_approval_status = "approved"
    profile.save(update_fields=["role", "expert_approval_status"])
