import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://10.0.2.2:8000/api";

async function fetchWithAuth(url: string, options: any = {}) {
  let access = await AsyncStorage.getItem("access");

  let res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${access}` },
  });

  if (res.status === 401) {
    const refresh = await AsyncStorage.getItem("refresh");
    if (refresh) {
      const r = await fetch(`${API_BASE}/users/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (r.ok) {
        const j = await r.json();
        await AsyncStorage.setItem("access", j.access);
        access = j.access;

        res = await fetch(url, {
          ...options,
          headers: { ...(options.headers || {}), Authorization: `Bearer ${access}` },
        });
      }
    }
  }

  return res;
}

export async function assistantChat(message: string, sessionId?: string, plantId?: number, language?: string) {
  const res = await fetchWithAuth(`${API_BASE}/assistant/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      plant_id: plantId,
      language: language || 'he',
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw || "Assistant request failed");
  }
  return JSON.parse(raw);
}

export async function getAssistantMessages(sessionId: string) {
  const res = await fetchWithAuth(`${API_BASE}/assistant/sessions/${sessionId}/messages/`, {
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw || "Failed to load messages");
  }
  return JSON.parse(raw);
}

export async function getAssistantSessions() {
  const res = await fetchWithAuth(`${API_BASE}/assistant/sessions/`, {
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw || "Failed to load sessions");
  }
  return JSON.parse(raw);
}
