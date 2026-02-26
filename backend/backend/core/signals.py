from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Profile

@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    # create profile for new users, and also ensure it exists for old users
    Profile.objects.get_or_create(user=instance)
