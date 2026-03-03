import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://10.0.2.2:8000/api";

export type FeedPost = {
  id: number;
  text: string;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
  author_username: string;
  author_avatar?: string | null;
  likes_count: number;
  is_liked: boolean;
  can_edit: boolean;
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

export async function listFeedPosts(): Promise<FeedPost[]> {
  const res = await fetchWithAuth(`${API_BASE}/feed/posts/`, {
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to load feed");
  return JSON.parse(raw);
}

export async function createFeedPost(text: string, imageUri?: string | null): Promise<FeedPost> {
  const formData = new FormData();
  formData.append("text", text);

  if (imageUri) {
    formData.append(
      "image",
      {
        uri: imageUri,
        name: `post-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any
    );
  }

  const res = await fetchWithAuth(`${API_BASE}/feed/posts/create/`, {
    method: "POST",
    body: formData,
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to create post");
  return JSON.parse(raw);
}

export async function updateFeedPost(
  postId: number,
  text: string,
  options?: { imageUri?: string | null; removeImage?: boolean }
): Promise<FeedPost> {
  const formData = new FormData();
  formData.append("text", text);

  if (options?.removeImage) {
    formData.append("remove_image", "true");
  }

  if (options?.imageUri) {
    formData.append(
      "image",
      {
        uri: options.imageUri,
        name: `post-${postId}-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as any
    );
  }

  const res = await fetchWithAuth(`${API_BASE}/feed/posts/${postId}/update/`, {
    method: "PUT",
    body: formData,
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to update post");
  return JSON.parse(raw);
}

export async function deleteFeedPost(postId: number): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/feed/posts/${postId}/delete/`, {
    method: "DELETE",
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to delete post");
}

export async function toggleLike(postId: number): Promise<{ liked: boolean; likes_count: number }> {
  const res = await fetchWithAuth(`${API_BASE}/feed/posts/${postId}/toggle-like/`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to like post");
  return JSON.parse(raw);
}