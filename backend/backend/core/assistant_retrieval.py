from __future__ import annotations

from typing import List, Dict

from .models import AssistantExpertTip, ExpertPost


def _score_text(query: str, text: str) -> float:
    q_tokens = {token for token in query.lower().split() if token}
    if not q_tokens:
        return 0.0
    text_lower = (text or "").lower()
    matches = sum(1 for token in q_tokens if token in text_lower)
    return matches / max(1, len(q_tokens))


def retrieve_tips(query: str, top_k: int = 3) -> List[Dict[str, object]]:
    candidates: List[Dict[str, object]] = []

    for tip in AssistantExpertTip.objects.filter(is_active=True)[:200]:
        score = _score_text(query, f"{tip.title} {tip.content}") * float(tip.source_quality or 0.7)
        if score > 0:
            candidates.append(
                {
                    "source": "assistant_tip",
                    "id": tip.id,
                    "title": tip.title,
                    "content": tip.content,
                    "score": float(score),
                }
            )

    for post in ExpertPost.objects.all()[:200]:
        score = _score_text(query, f"{post.title} {post.content}")
        if score > 0:
            candidates.append(
                {
                    "source": "expert_post",
                    "id": post.id,
                    "title": post.title,
                    "content": post.content,
                    "score": float(score * 0.8),
                }
            )

    candidates.sort(key=lambda item: item["score"], reverse=True)
    return candidates[:top_k]
