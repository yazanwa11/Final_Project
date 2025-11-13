from django.db import models
from django.contrib.auth.models import User

class Plant(models.Model):
    CATEGORY_CHOICES = [
        ('Vegetable', 'Vegetable'),
        ('Flower', 'Flower'),
        ('Herb', 'Herb'),
        ('Tree', 'Tree'),
        ('Indoor', 'Indoor'),
    ]

    user = models.ForeignKey(
    User,
    on_delete=models.CASCADE,
    related_name="plants",
    null=False,
    blank=False)


    name = models.CharField(max_length=100)
    category = models.CharField(
    max_length=50,
    choices=CATEGORY_CHOICES,
    default='Vegetable')

    location = models.CharField(max_length=100, blank=True)
    planting_date = models.DateField(null=True, blank=True)
    image = models.ImageField(upload_to='plants/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Profile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile"
    )
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    def __str__(self):
        return self.user.username


class CareLog(models.Model):
    ACTION_CHOICES = [
        ("Watered", "Watered"),
        ("Fertilized", "Fertilized"),
        ("Sunlight", "Sunlight"),
        ("Pruned", "Pruned"),
        ("Repotted", "Repotted"),
        ("Other", "Other"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="care_logs")
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="care_logs")

    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    notes = models.TextField(blank=True, null=True)

    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.plant.name} - {self.action}"
