from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .assistant_orchestrator import run_assistant
from .models import AssistantSession, AssistantMessage, Plant


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assistant_chat(request):
    message = (request.data.get("message") or "").strip()
    session_id = request.data.get("session_id")
    plant_id = request.data.get("plant_id")
    language = request.data.get("language", "he")  # Default to Hebrew

    if not message:
        return Response({"detail": "message is required"}, status=400)

    plant = None
    if plant_id is not None:
        plant = get_object_or_404(Plant, id=plant_id, user=request.user)

    if session_id:
        session = get_object_or_404(AssistantSession, id=session_id, user=request.user)
    else:
        session = AssistantSession.objects.create(
            user=request.user,
            plant=plant,
            title=(message[:60] + "...") if len(message) > 60 else message,
        )

    result = run_assistant(session=session, user_message=message, plant_id=plant.id if plant else None, language=language)

    return Response(
        {
            "session_id": str(session.id),
            "answer": result["answer"],
            "follow_up_questions": result.get("follow_up_questions", []),
            "safety_flags": result.get("safety_flags", []),
            "confidence": result.get("confidence", 0.0),
            "retrieved": result.get("retrieved", []),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assistant_session_messages(request, session_id):
    session = get_object_or_404(AssistantSession, id=session_id, user=request.user)
    messages = AssistantMessage.objects.filter(session=session).order_by("created_at")
    payload = [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "metadata": msg.metadata,
            "created_at": msg.created_at,
        }
        for msg in messages
    ]
    return Response({"session_id": str(session.id), "messages": payload})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def assistant_sessions(request):
    sessions = AssistantSession.objects.filter(user=request.user).order_by("-updated_at")[:50]
    payload = [
        {
            "id": str(s.id),
            "title": s.title,
            "plant_id": s.plant_id,
            "updated_at": s.updated_at,
        }
        for s in sessions
    ]
    return Response(payload)
