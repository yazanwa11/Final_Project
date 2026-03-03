import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://10.0.2.2:8000/api";

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  date_joined: string;
  role: "admin" | "expert" | "user";
  expert_approval_status: "pending" | "approved" | "rejected";
  plants_count: number;
};

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let access = await AsyncStorage.getItem("access");

  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${access}`,
    },
  });

  if (response.status === 401) {
    const refresh = await AsyncStorage.getItem("refresh");
    if (refresh) {
      const refreshResponse = await fetch(`${API_BASE}/users/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        await AsyncStorage.setItem("access", tokens.access);
        access = tokens.access;

        response = await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${access}`,
          },
        });
      }
    }
  }

  return response;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const res = await fetchWithAuth(`${API_BASE}/admin/users/`, {
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to load users");
  return JSON.parse(raw);
}

export async function listPendingExperts(): Promise<AdminUser[]> {
  const res = await fetchWithAuth(`${API_BASE}/admin/experts/pending/`, {
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to load pending experts");
  return JSON.parse(raw);
}

export async function updateAdminUser(
  userId: number,
  payload: Partial<Pick<AdminUser, "username" | "email" | "is_active" | "role" | "expert_approval_status">>
): Promise<AdminUser> {
  const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/update/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to update user");
  return JSON.parse(raw);
}

export async function deleteAdminUser(userId: number): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/delete/`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const raw = await res.text();
    throw new Error(raw || "Failed to delete user");
  }
}

export async function reviewExpert(userId: number, action: "approve" | "reject"): Promise<AdminUser> {
  const res = await fetchWithAuth(`${API_BASE}/admin/experts/${userId}/review/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to review expert");
  return JSON.parse(raw);
}
