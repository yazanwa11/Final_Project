from __future__ import annotations

from typing import Dict, Any, List
import requests
from django.conf import settings


def _build_messages(user_message: str, context_block: str, retrieved: List[Dict[str, object]], follow_ups: List[str], language="he") -> str:
    evidence_lines = []
    for item in retrieved:
        title = str(item.get("title") or "")
        content = str(item.get("content") or "")
        if title or content:
            evidence_lines.append(f"- {title}: {content[:400]}")

    follow_up_text = "\n".join(f"- {q}" for q in follow_ups) if follow_ups else "- none"
    evidence_text = "\n".join(evidence_lines) if evidence_lines else "- none"

    # Language instruction
    language_instruction = ""
    if language == "he":
        language_instruction = "IMPORTANT: Respond in Hebrew language. All your answers must be in Hebrew.\n"
    elif language == "en":
        language_instruction = "IMPORTANT: Respond in English language.\n"

    return (
        "You are an AI gardening assistant.\n"
        f"{language_instruction}"
        "Rules:\n"
        "1) Give practical, safe gardening advice only.\n"
        "2) If data is missing, ask concise follow-up questions.\n"
        "3) Avoid dangerous chemical instructions and overconfident claims.\n"
        "4) Personalize using user context and evidence.\n"
        "5) Answer directly (not generic template).\n\n"
        "6) Keep responses concise (5-10 lines) unless user asks for full detail.\n\n"
        f"User context:\n{context_block}\n\n"
        f"Retrieved evidence:\n{evidence_text}\n\n"
        f"Suggested follow-up candidates:\n{follow_up_text}\n\n"
        f"User question: {user_message}\n\n"
        "Return plain text with:\n"
        "- Direct answer\n"
        "- Action steps\n"
        "- Caution note if needed\n"
        "- Follow-up question only when necessary"
    )


def generate_with_gemini(user_message: str, context_block: str, retrieved: List[Dict[str, object]], follow_ups: List[str], language="he") -> Dict[str, Any]:
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    model = getattr(settings, "GEMINI_MODEL", "gemini-1.5-pro")

    if not api_key:
        return {"ok": False, "error": "missing_api_key"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload_text = _build_messages(user_message, context_block, retrieved, follow_ups, language)

    response = requests.post(
        url,
        params={"key": api_key},
        json={
            "contents": [
                {
                    "parts": [{"text": payload_text}],
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "topP": 0.9,
                "maxOutputTokens": 2048,
            },
        },
        timeout=25,
    )

    if response.status_code != 200:
        return {"ok": False, "error": f"gemini_http_{response.status_code}", "detail": response.text[:500]}

    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return {"ok": False, "error": "no_candidates"}

    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "\n".join(str(part.get("text") or "") for part in parts if part.get("text")).strip()
    if not text:
        retry_response = requests.post(
            url,
            params={"key": api_key},
            json={
                "contents": [
                    {
                        "parts": [{"text": f"Answer this gardening question safely and clearly:\n{user_message}"}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "topP": 0.9,
                    "maxOutputTokens": 2048,
                },
            },
            timeout=20,
        )

        if retry_response.status_code != 200:
            return {"ok": False, "error": "empty_text"}

        retry_data = retry_response.json()
        retry_candidates = retry_data.get("candidates") or []
        if not retry_candidates:
            return {"ok": False, "error": "empty_text"}

        retry_parts = (retry_candidates[0].get("content") or {}).get("parts") or []
        text = "\n".join(str(part.get("text") or "") for part in retry_parts if part.get("text")).strip()
        if not text:
            return {"ok": False, "error": "empty_text"}

    return {"ok": True, "text": text}
