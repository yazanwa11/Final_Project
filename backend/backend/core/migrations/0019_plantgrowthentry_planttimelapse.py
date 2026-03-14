from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0018_profile_expert_approval_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlantGrowthEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="growth_journal/%Y/%m/%d/")),
                ("notes", models.TextField(blank=True, default="")),
                ("captured_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "plant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="growth_entries", to="core.plant"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plant_growth_entries", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["captured_at", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="PlantTimelapse",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="timelapse/%Y/%m/%d/")),
                ("frame_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "plant",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="timelapses", to="core.plant"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plant_timelapses", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
