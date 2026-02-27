from django.db import models
from django.contrib.auth.models import User
import uuid

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
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    location_timezone = models.CharField(max_length=64, blank=True, default="")
    weather_opt_in = models.BooleanField(default=True)
    dynamic_watering_interval = models.IntegerField(default=3)
    last_weather_adjusted_at = models.DateTimeField(null=True, blank=True)
    



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


class DiseaseProfile(models.Model):
    URGENCY_CHOICES = [
        ("low", "low"),
        ("medium", "medium"),
        ("high", "high"),
        ("critical", "critical"),
    ]

    code = models.CharField(max_length=64, unique=True)
    display_name = models.CharField(max_length=128)
    treatment_recommendation = models.TextField()
    urgency_level = models.CharField(max_length=16, choices=URGENCY_CHOICES)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self):
        return f"{self.display_name} ({self.code})"


class Prediction(models.Model):
    STATUS_CHOICES = [
        ("pending", "pending"),
        ("done", "done"),
        ("failed", "failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="predictions")
    plant = models.ForeignKey(Plant, on_delete=models.SET_NULL, null=True, blank=True, related_name="predictions")
    image = models.ImageField(upload_to="predictions/%Y/%m/%d/")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending", db_index=True)

    disease = models.ForeignKey(DiseaseProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="predictions")
    confidence_score = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True)
    treatment_recommendation = models.TextField(blank=True, default="")
    urgency_level = models.CharField(max_length=16, blank=True, default="")

    model_version = models.CharField(max_length=32, default="heuristic_v1")
    raw_topk = models.JSONField(default=dict, blank=True)
    failure_reason = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Prediction {self.id} - {self.user.username} - {self.status}"


class WeatherSnapshot(models.Model):
    location_key = models.CharField(max_length=160, db_index=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    timezone = models.CharField(max_length=64, blank=True, default="")

    next24h_rain_prob_max = models.FloatField(default=0.0)
    next24h_rain_mm_sum = models.FloatField(default=0.0)
    next48h_temp_max = models.FloatField(default=0.0)
    next48h_temp_min = models.FloatField(default=0.0)
    frost_risk = models.BooleanField(default=False)
    heatwave_risk = models.BooleanField(default=False)

    provider = models.CharField(max_length=32, default="open-meteo")
    payload = models.JSONField(default=dict, blank=True)
    forecast_at = models.DateTimeField()
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-forecast_at"]
        indexes = [
            models.Index(fields=["location_key", "-forecast_at"]),
        ]

    def __str__(self):
        return f"{self.location_key} @ {self.forecast_at}"


class SmartReminderEvent(models.Model):
    EVENT_CHOICES = [
        ("watering_skipped_rain", "watering_skipped_rain"),
        ("heatwave_alert", "heatwave_alert"),
        ("frost_warning", "frost_warning"),
        ("interval_adjusted", "interval_adjusted"),
    ]

    SEVERITY_CHOICES = [
        ("low", "low"),
        ("medium", "medium"),
        ("high", "high"),
    ]

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="smart_events")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="smart_events")
    event_type = models.CharField(max_length=64, choices=EVENT_CHOICES)
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES)
    decision_reason = models.TextField(blank=True, default="")
    effective_from = models.DateTimeField()
    effective_to = models.DateTimeField(null=True, blank=True)
    is_sent = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["plant", "-created_at"]),
            models.Index(fields=["user", "is_sent"]),
        ]

    def __str__(self):
        return f"{self.plant.name} - {self.event_type}"


class PlantHealthSnapshot(models.Model):
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="health_snapshots")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="plant_health_snapshots")

    score = models.IntegerField(default=0)
    window_days = models.IntegerField(default=30)

    watering_subscore = models.FloatField(default=0.0)
    fertilizing_subscore = models.FloatField(default=0.0)
    disease_subscore = models.FloatField(default=0.0)
    growth_subscore = models.FloatField(default=0.0)
    missed_subscore = models.FloatField(default=0.0)

    version = models.CharField(max_length=32, default="health_v1")
    explanation_json = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["plant", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.plant.name} health {self.score} ({self.version})"


class AssistantSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="assistant_sessions")
    plant = models.ForeignKey(Plant, on_delete=models.SET_NULL, null=True, blank=True, related_name="assistant_sessions")
    title = models.CharField(max_length=140, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Session {self.id} - {self.user.username}"


class AssistantMessage(models.Model):
    ROLE_CHOICES = [
        ("user", "user"),
        ("assistant", "assistant"),
        ("system", "system"),
    ]

    session = models.ForeignKey(AssistantSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.session_id} - {self.role}"


class AssistantExpertTip(models.Model):
    source = models.CharField(max_length=80, default="expert")
    title = models.CharField(max_length=160)
    content = models.TextField()
    tags = models.JSONField(default=list, blank=True)
    source_quality = models.FloatField(default=0.7)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class AssistantRetrievedChunkLog(models.Model):
    session = models.ForeignKey(AssistantSession, on_delete=models.CASCADE, related_name="retrieval_logs")
    tip = models.ForeignKey(AssistantExpertTip, on_delete=models.SET_NULL, null=True, blank=True)
    source = models.CharField(max_length=80, default="expert_tip")
    score = models.FloatField(default=0.0)
    chunk_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class AssistantAdviceAudit(models.Model):
    session = models.ForeignKey(AssistantSession, on_delete=models.CASCADE, related_name="audits")
    user_message = models.TextField()
    assistant_response = models.TextField()
    safety_flags = models.JSONField(default=list, blank=True)
    retrieval_count = models.IntegerField(default=0)
    confidence = models.FloatField(default=0.0)
    model_name = models.CharField(max_length=64, default="rule_rag_v1")
    latency_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
