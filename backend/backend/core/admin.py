from django.contrib import admin
from .models import (
	Plant,
	Profile,
	CareLog,
	Reminder,
	Notification,
	ExpertPost,
	ExpertInquiry,
	DiseaseProfile,
	Prediction,
	WeatherSnapshot,
	SmartReminderEvent,
	PlantHealthSnapshot,
	AssistantSession,
	AssistantMessage,
	AssistantExpertTip,
	AssistantRetrievedChunkLog,
	AssistantAdviceAudit,
)

admin.site.register(Plant)
admin.site.register(Profile)
admin.site.register(CareLog)
admin.site.register(Reminder)
admin.site.register(Notification)
admin.site.register(ExpertPost)
admin.site.register(ExpertInquiry)
admin.site.register(DiseaseProfile)
admin.site.register(Prediction)
admin.site.register(WeatherSnapshot)
admin.site.register(SmartReminderEvent)
admin.site.register(PlantHealthSnapshot)
admin.site.register(AssistantSession)
admin.site.register(AssistantMessage)
admin.site.register(AssistantExpertTip)
admin.site.register(AssistantRetrievedChunkLog)
admin.site.register(AssistantAdviceAudit)
