import os
import json
import re
import base64
from typing import Dict, Any
import requests
from django.conf import settings
from PIL import Image, ImageStat


DEFAULT_DISEASES: Dict[str, Dict[str, str]] = {
    "healthy": {
        "display_name": "Healthy",
        "treatment": "No treatment needed. Continue regular watering, pruning, and monitoring.",
        "urgency": "low",
    },
    "leaf_spot": {
        "display_name": "Leaf Spot",
        "treatment": "Remove affected leaves, improve airflow, avoid overhead watering, and apply a copper-based fungicide if spread continues.",
        "urgency": "medium",
    },
    "blight": {
        "display_name": "Blight",
        "treatment": "Isolate the plant, remove infected tissue, sanitize tools, and apply targeted fungicide according to label guidance.",
        "urgency": "high",
    },
    "powdery_mildew": {
        "display_name": "Powdery Mildew",
        "treatment": "Increase ventilation, reduce humidity, remove affected leaves, and apply sulfur or potassium bicarbonate treatment.",
        "urgency": "medium",
    },
}


class InferenceService:
    MODEL_VERSION = "gemini_vision_v1"

    @classmethod
    def _extract_json(cls, text: str) -> Dict[str, Any] | None:
        if not text:
            return None

        raw = text.strip()
        fence_match = re.search(r"```json\s*(\{.*?\})\s*```", raw, flags=re.DOTALL)
        if fence_match:
            raw = fence_match.group(1)
        else:
            brace_match = re.search(r"(\{.*\})", raw, flags=re.DOTALL)
            if brace_match:
                raw = brace_match.group(1)

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None
        return None

    @classmethod
    def _predict_with_gemini(cls, image_path: str, language="he") -> Dict[str, Any] | None:
        api_key = getattr(settings, "GEMINI_API_KEY", "")
        model = getattr(settings, "GEMINI_VISION_MODEL", "gemini-2.5-flash")
        if not api_key:
            return None

        with open(image_path, "rb") as file_obj:
            encoded = base64.b64encode(file_obj.read()).decode("utf-8")

        # Language instruction
        language_instruction = ""
        if language == "he":
            language_instruction = "IMPORTANT: Provide disease_name and treatment_recommendation fields in Hebrew language. "
        elif language == "en":
            language_instruction = "IMPORTANT: Provide disease_name and treatment_recommendation fields in English language. "

        prompt = (
            f"You are a plant disease analysis assistant. {language_instruction}"
            "Analyze the plant image and return ONLY valid JSON with fields: "
            "disease_code, disease_name, confidence_score, treatment_recommendation, urgency_level, raw_topk. "
            "Rules: urgency_level must be one of low, medium, high, critical. "
            "confidence_score must be between 0 and 1. "
            "raw_topk must be an object of up to 4 labels with probabilities summing approximately to 1."
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        response = requests.post(
            url,
            params={"key": api_key},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": encoded,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "topP": 0.9,
                    "maxOutputTokens": 2048,
                },
            },
            timeout=35,
        )

        if response.status_code != 200:
            return None

        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            return None

        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "\n".join(str(part.get("text") or "") for part in parts if part.get("text")).strip()
        parsed = cls._extract_json(text)
        if not parsed:
            return None

        disease_code = str(parsed.get("disease_code") or "unknown").strip().lower().replace(" ", "_")
        disease_name = str(parsed.get("disease_name") or disease_code.replace("_", " ").title())
        confidence_score = float(parsed.get("confidence_score") or 0.6)
        confidence_score = max(0.0, min(1.0, confidence_score))
        urgency_level = str(parsed.get("urgency_level") or "medium").strip().lower()
        if urgency_level not in {"low", "medium", "high", "critical"}:
            urgency_level = "medium"

        treatment = str(parsed.get("treatment_recommendation") or "Inspect plant, isolate if needed, and monitor closely.")
        raw_topk = parsed.get("raw_topk") if isinstance(parsed.get("raw_topk"), dict) else {disease_code: confidence_score}

        return {
            "disease_code": disease_code,
            "disease_name": disease_name,
            "confidence_score": confidence_score,
            "treatment_recommendation": treatment,
            "urgency_level": urgency_level,
            "model_version": cls.MODEL_VERSION,
            "raw_topk": raw_topk,
        }

    @classmethod
    def predict(cls, image_path: str, language="he") -> Dict[str, Any]:
        gemini_result = cls._predict_with_gemini(image_path, language=language)
        if gemini_result:
            return gemini_result

        return cls._predict_heuristic(image_path)

    @classmethod
    def _predict_heuristic(cls, image_path: str) -> Dict[str, Any]:
        image = Image.open(image_path).convert("RGB")
        stat = ImageStat.Stat(image)
        r_mean, g_mean, b_mean = stat.mean

        green_strength = g_mean - (r_mean + b_mean) / 2
        yellow_brown_strength = (r_mean + g_mean) / 2 - b_mean

        if green_strength > 14:
            disease_code = "healthy"
            confidence = 0.88
            topk = {
                "healthy": 0.88,
                "leaf_spot": 0.06,
                "powdery_mildew": 0.04,
                "blight": 0.02,
            }
        elif yellow_brown_strength > 35:
            disease_code = "blight"
            confidence = 0.79
            topk = {
                "blight": 0.79,
                "leaf_spot": 0.11,
                "powdery_mildew": 0.06,
                "healthy": 0.04,
            }
        elif b_mean > 135:
            disease_code = "powdery_mildew"
            confidence = 0.73
            topk = {
                "powdery_mildew": 0.73,
                "leaf_spot": 0.16,
                "healthy": 0.07,
                "blight": 0.04,
            }
        else:
            disease_code = "leaf_spot"
            confidence = 0.69
            topk = {
                "leaf_spot": 0.69,
                "powdery_mildew": 0.15,
                "blight": 0.10,
                "healthy": 0.06,
            }

        disease_meta = DEFAULT_DISEASES[disease_code]
        return {
            "disease_code": disease_code,
            "disease_name": disease_meta["display_name"],
            "confidence_score": confidence,
            "treatment_recommendation": disease_meta["treatment"],
            "urgency_level": disease_meta["urgency"],
            "model_version": "heuristic_v1",
            "raw_topk": topk,
        }
