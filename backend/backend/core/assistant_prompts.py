from __future__ import annotations

from typing import Dict, List


def build_context_block(user_context: Dict[str, object], retrieved: List[Dict[str, object]]) -> str:
    plants = user_context.get("plants", [])
    plant_lines = []
    for plant in plants:
        plant_lines.append(
            f"- {plant['name']} ({plant['category']}), watering every {plant['watering_interval']} days"
        )

    retrieval_lines = []
    for item in retrieved:
        retrieval_lines.append(f"- {item['title']}: {item['content'][:280]}")

    context_text = "\n".join(plant_lines) if plant_lines else "- No plant context available"
    evidence_text = "\n".join(retrieval_lines) if retrieval_lines else "- No expert evidence found"

    return (
        "User plants:\n"
        f"{context_text}\n\n"
        "Expert evidence:\n"
        f"{evidence_text}"
    )


def needs_follow_up(message: str, user_context: Dict[str, object]) -> List[str]:
    questions = []
    if not user_context.get("plants"):
        questions.append("Which plant are you asking about?")
    lowered = (message or "").lower()
    if "yellow" in lowered or "spots" in lowered:
        questions.append("How long have you seen these symptoms?")
    if "water" in lowered:
        questions.append("What is your current watering frequency?")
    return questions[:2]
