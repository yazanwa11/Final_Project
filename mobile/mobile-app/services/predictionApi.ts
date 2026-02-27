const API_BASE = "http://10.0.2.2:8000/api";

export type PredictionResult = {
  id: string;
  status: "pending" | "done" | "failed";
  image_url: string | null;
  disease_name: string | null;
  confidence_score: string | null;
  treatment_recommendation: string;
  urgency_level: string;
  model_version: string;
  raw_topk: Record<string, number>;
  failure_reason: string;
  created_at: string;
  completed_at: string | null;
};

export async function createPrediction(
  token: string,
  imageUri: string,
  plantId?: number,
  language?: string
): Promise<PredictionResult> {
  const formData = new FormData();
  formData.append("image", {
    uri: imageUri,
    name: "plant.jpg",
    type: "image/jpeg",
  } as any);

  if (plantId) {
    formData.append("plant_id", String(plantId));
  }

  if (language) {
    formData.append("language", language);
  }

  const response = await fetch(`${API_BASE}/predictions/create/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Prediction request failed");
  }

  return data;
}

export async function getPrediction(token: string, predictionId: string): Promise<PredictionResult> {
  const response = await fetch(`${API_BASE}/predictions/${predictionId}/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Failed to fetch prediction");
  }

  return data;
}

export async function listPredictions(token: string, plantId?: number): Promise<PredictionResult[]> {
  const qs = plantId ? `?plant_id=${encodeURIComponent(String(plantId))}` : "";
  const response = await fetch(`${API_BASE}/predictions/${qs}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Failed to list predictions");
  }

  return data;
}
