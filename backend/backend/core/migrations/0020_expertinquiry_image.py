from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0019_plantgrowthentry_planttimelapse"),
    ]

    operations = [
        migrations.AddField(
            model_name="expertinquiry",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="expert_inquiries/"),
        ),
    ]
