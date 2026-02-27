from __future__ import annotations

import time
from typing import Dict, Any, List
import re

from .assistant_prompts import build_context_block, needs_follow_up
from .assistant_retrieval import retrieve_tips
from .assistant_safety import classify_safety, post_validate_response
from .assistant_llm import generate_with_gemini
from .models import (
    AssistantAdviceAudit,
    AssistantMessage,
    AssistantRetrievedChunkLog,
    AssistantSession,
    Plant,
)


def _build_user_context(user, plant_id=None) -> Dict[str, Any]:
    query = Plant.objects.filter(user=user)
    if plant_id:
        query = query.filter(id=plant_id)

    plants = [
        {
            "id": plant.id,
            "name": plant.name,
            "category": plant.category,
            "watering_interval": plant.dynamic_watering_interval or plant.watering_interval,
        }
        for plant in query[:10]
    ]
    return {"plants": plants}


def _detect_intent(message: str) -> str:
    text = (message or "").lower()
    if any(token in text for token in ["height", "tall", "grow", "size"]):
        return "growth"
    if any(token in text for token in ["yellow", "spot", "disease", "fung", "mildew", "rot", "brown"]):
        return "disease"
    if any(token in text for token in ["water", "watering", "dry", "overwater"]):
        return "watering"
    if any(token in text for token in ["fertiliz", "nutrient", "feed", "npk"]):
        return "fertilizer"
    if any(token in text for token in ["sun", "light", "shade"]):
        return "sunlight"
    return "general"


def _extract_plant_name(message: str, user_context: Dict[str, Any]) -> str:
    text = (message or "").lower()
    plants = user_context.get("plants") or []
    for plant in plants:
        name = (plant.get("name") or "").strip()
        if name and name.lower() in text:
            return name
    if plants:
        return plants[0].get("name") or "your plant"
    return "your plant"


def _generate_answer(message: str, user_context: Dict[str, Any], retrieved: List[Dict[str, object]], follow_ups: List[str]) -> str:
    intent = _detect_intent(message)
    plant_name = _extract_plant_name(message, user_context)

    lines: List[str] = []
    lines.append(f"Here’s focused guidance for {plant_name}.")

    if intent == "growth":
        if "aloe" in (message or "").lower():
            lines.append("Aloe vera is usually about 30-60 cm tall indoors, and can reach around 60-100 cm in ideal outdoor conditions.")
        else:
            lines.append("Plant height depends on variety, pot size, light, and nutrient availability.")
        lines.append("To support healthy growth: provide enough light, avoid overwatering, and repot when roots are crowded.")
    elif intent == "disease":
        lines.append("For leaf symptoms, isolate the plant, remove heavily affected leaves, and improve airflow.")
        lines.append("Avoid wetting leaves during watering and monitor spread over the next 3-5 days.")
    elif intent == "watering":
        lines.append("Water only when the top 2-3 cm of soil feels dry, not by fixed daily timing.")
        lines.append("Ensure pot drainage and empty standing water from saucers.")
    elif intent == "fertilizer":
        lines.append("Use a balanced fertilizer at reduced strength during active growth, then pause or reduce in winter.")
        lines.append("Do not fertilize dry soil; water lightly first.")
    elif intent == "sunlight":
        lines.append("Most houseplants prefer bright indirect light; avoid sudden full-sun exposure changes.")
        lines.append("Rotate the pot weekly for even growth.")
    else:
        lines.append("Share the exact plant name and symptom (yellow leaves, spots, drooping, pests), and I’ll give a precise care plan.")

    if retrieved:
        top = retrieved[0]
        evidence = re.sub(r"\s+", " ", str(top.get("content") or "")).strip()
        if evidence:
            lines.append(f"Expert tip: {evidence[:220]}")

    if follow_ups:
        lines.append("Before I finalize a strong recommendation, please answer:")
        for question in follow_ups:
            lines.append(f"- {question}")

    lines.append("If symptoms worsen quickly, share a close leaf photo and recent watering pattern.")
    return "\n".join(lines)


def run_assistant(session: AssistantSession, user_message: str, plant_id=None, language="he") -> Dict[str, Any]:
    started = time.perf_counter()

    safety = classify_safety(user_message)
    if safety["blocked"]:
        AssistantMessage.objects.create(session=session, role="user", content=user_message)
        AssistantMessage.objects.create(session=session, role="assistant", content=safety["safe_response"], metadata={"flags": safety["flags"]})
        latency_ms = int((time.perf_counter() - started) * 1000)
        AssistantAdviceAudit.objects.create(
            session=session,
            user_message=user_message,
            assistant_response=safety["safe_response"],
            safety_flags=safety["flags"],
            retrieval_count=0,
            confidence=0.0,
            model_name="rule_rag_v1",
            latency_ms=latency_ms,
        )
        return {
            "answer": safety["safe_response"],
            "follow_up_questions": [],
            "safety_flags": safety["flags"],
            "confidence": 0.0,
        }

    user_context = _build_user_context(session.user, plant_id=plant_id)
    retrieved = retrieve_tips(user_message, top_k=3)
    follow_ups = needs_follow_up(user_message, user_context)
    context_block = build_context_block(user_context, retrieved)

    llm_result = generate_with_gemini(user_message, context_block, retrieved, follow_ups, language)
    if llm_result.get("ok"):
        answer = str(llm_result.get("text") or "").strip()
    else:
        answer = _generate_answer(user_message, user_context, retrieved, follow_ups)
    post_validation = post_validate_response(answer)
    if not post_validation["ok"]:
        answer = "I can help with safe and practical plant-care steps. Please share your plant type and symptoms for a safe recommendation."

    AssistantMessage.objects.create(session=session, role="user", content=user_message)
    AssistantMessage.objects.create(
        session=session,
        role="assistant",
        content=answer,
        metadata={
            "follow_up_questions": follow_ups,
            "retrieval_count": len(retrieved),
        },
    )

    for item in retrieved:
        AssistantRetrievedChunkLog.objects.create(
            session=session,
            source=item["source"],
            score=float(item["score"]),
            chunk_text=item["content"][:1000],
        )

    confidence = 0.55 + min(0.35, len(retrieved) * 0.1) - (0.1 if follow_ups else 0.0)
    confidence = max(0.0, min(1.0, confidence))

    latency_ms = int((time.perf_counter() - started) * 1000)
    AssistantAdviceAudit.objects.create(
        session=session,
        user_message=user_message,
        assistant_response=answer,
        safety_flags=[] if post_validation["ok"] else post_validation["flags"],
        retrieval_count=len(retrieved),
        confidence=confidence,
        model_name="gemini_rag_v1" if llm_result.get("ok") else "rule_rag_v1",
        latency_ms=latency_ms,
    )

    return {
        "answer": answer,
        "follow_up_questions": follow_ups,
        "safety_flags": [] if post_validation["ok"] else post_validation["flags"],
        "confidence": confidence,
        "retrieved": [{"title": item["title"], "score": item["score"]} for item in retrieved],
        "context_summary": user_context,
    }
