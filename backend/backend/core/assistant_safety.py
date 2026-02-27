from typing import Dict, List


UNSAFE_KEYWORDS = [
    "poison",
    "bleach",
    "acid",
    "harm",
    "kill animal",
    "kill pet",
    "toxic gas",
]


def classify_safety(user_text: str) -> Dict[str, object]:
    lowered = (user_text or "").lower()
    flags: List[str] = [kw for kw in UNSAFE_KEYWORDS if kw in lowered]
    blocked = len(flags) > 0
    return {
        "blocked": blocked,
        "flags": flags,
        "safe_response": "I can’t help with unsafe or harmful gardening instructions. I can help with safe plant care alternatives instead.",
    }


def post_validate_response(answer: str) -> Dict[str, object]:
    lowered = (answer or "").lower()
    risky_claims = []
    if "guaranteed" in lowered:
        risky_claims.append("overconfident_claim")
    if "drink" in lowered and "pesticide" in lowered:
        risky_claims.append("dangerous_instruction")

    return {
        "ok": len(risky_claims) == 0,
        "flags": risky_claims,
    }
