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
    image_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    watering_interval = models.IntegerField(default=3)  # days
    sunlight_interval = models.IntegerField(default=1)  # days
    last_watered = models.DateTimeField(null=True, blank=True)
    last_sunlight = models.DateTimeField(null=True, blank=True)
    



    def __str__(self):
        return self.name


class Profile(models.Model):
    ROLE_CHOICES = [
        ("user", "User"),
        ("expert", "Expert"),
        ("admin", "Admin"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile"
    )
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    ROLE_CHOICES = [
    ("user", "User"),
    ("expert", "Expert"),
    ("admin", "Admin"),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")


    def __str__(self):
        return self.user.username

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


class Reminder(models.Model):
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="reminders")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    type = models.CharField(max_length=50, choices=[
        ("Watering", "Watering"),
        ("Sunlight", "Sunlight"),
        ("Fertilizing", "Fertilizing"),
    ])
    frequency_days = models.IntegerField()   # every X days
    next_run = models.DateTimeField()        # when next notification should fire
    created_at = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    TYPE_CHOICES = [
        ("expert_reply", "Expert Reply"),
        ("new_expert_post", "New Expert Post"),
        ("system", "System"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True)  # thread_id, post_id, plant_id...
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.type} - {self.title}"


class ExpertPost(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="expert_posts")
    title = models.CharField(max_length=150)
    content = models.TextField()
    image_url = models.URLField(blank=True, null=True)  # optional
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.author.username})"    
    

class ExpertInquiry(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("answered", "Answered"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="expert_inquiries")
    plant_name = models.CharField(max_length=100, blank=True, default="")
    question = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")

    answered_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="answered_inquiries"
    )
    answer = models.TextField(blank=True, null=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
