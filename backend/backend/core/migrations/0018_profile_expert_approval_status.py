from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_communitypost_communitypostlike"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="expert_approval_status",
            field=models.CharField(
                choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
                default="approved",
                max_length=20,
            ),
        ),
    ]
