import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ExpertPost = {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  author_username?: string;
  created_at?: string;
};

export default function ExploreScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  const [posts, setPosts] = useState<ExpertPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);

  // Explore Search
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Ask Expert (normal user)
  const [askOpen, setAskOpen] = useState(false);
  const [askPlant, setAskPlant] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  // Create Post (expert)
  const [createOpen, setCreateOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [publishing, setPublishing] = useState(false);

  // View Post Modal
  const [postOpen, setPostOpen] = useState(false);
  const [activePost, setActivePost] = useState<ExpertPost | null>(null);

  // Simple toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastBody, setToastBody] = useState("");

  const isExpert = user?.role === "expert";

  const headerSubtitle = useMemo(() => {
    if (!user) return "Tips, articles, and expert support";
    if (isExpert) return "Publish posts and help users with questions";
    return "Search tips and ask an expert when you need help";
  }, [user, isExpert]);

  const showToast = (title: string, body: string) => {
    setToastTitle(title);
    setToastBody(body);
    setToastOpen(true);
  };

  async function fetchWithAuth(url: string, options: any = {}) {
    let access = await AsyncStorage.getItem("access");

    let res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${access}` },
    });

    if (res.status === 401) {
      const refresh = await AsyncStorage.getItem("refresh");
      if (!refresh) return res;

      const refreshRes = await fetch("http://10.0.2.2:8000/api/users/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!refreshRes.ok) return res;

      const tokens = await refreshRes.json();
      await AsyncStorage.setItem("access", tokens.access);
      access = tokens.access;

      res = await fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${access}` },
      });
    }

    return res;
  }

  const loadUser = async () => {
    try {
      const res = await fetchWithAuth("http://10.0.2.2:8000/api/users/me/", {
        headers: { Accept: "application/json" },
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw);

      const data = JSON.parse(raw);
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  const loadUnread = async () => {
    try {
      const res = await fetchWithAuth("http://10.0.2.2:8000/api/notifications/", {
        headers: { Accept: "application/json" },
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw);

      const data = JSON.parse(raw);
      const unread = Array.isArray(data) ? data.filter((n: any) => !n.is_read).length : 0;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  };

  const loadPosts = async (q?: string) => {
    try {
      setError(null);

      const qv = (q ?? "").trim();
      const url =
        qv.length > 0
          ? `http://10.0.2.2:8000/api/explore/posts/?q=${encodeURIComponent(qv)}`
          : "http://10.0.2.2:8000/api/explore/posts/";

      const res = await fetchWithAuth(url, {
        headers: { Accept: "application/json" },
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(`Explore feed failed: ${res.status} ${raw}`);

      const data = JSON.parse(raw);
      setPosts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setPosts([]);
      setError(e?.message || "Failed to load Explore");
    }
  };

  const loadSuggestions = async (q: string) => {
    try {
      const qv = q.trim();
      if (!qv) {
        setSuggestions([]);
        return;
      }

      const url = `http://10.0.2.2:8000/api/plants/suggestions/?q=${encodeURIComponent(qv)}`;
      const res = await fetchWithAuth(url, { headers: { Accept: "application/json" } });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw);

      const data = JSON.parse(raw);
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadUser(), loadPosts(), loadUnread()]);
      setLoading(false);
    })();
  }, []);

  // Debounced search: filters expert posts and plant suggestions
  useEffect(() => {
    if (loading) return;

    const t = setTimeout(async () => {
      const q = query.trim();

      if (!q) {
        setSearching(false);
        setSuggestions([]);
        await loadPosts();
        return;
      }

      setSearching(true);
      await Promise.all([loadPosts(q), loadSuggestions(q)]);
      setSearching(false);
    }, 450);

    return () => clearTimeout(t);
  }, [query, loading]);

  useEffect(
    useCallback(() => {
      loadUnread();
      return () => { };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);

    const q = query.trim();

    await Promise.all([
      loadUnread(),
      q ? loadPosts(q) : loadPosts(),
      q ? loadSuggestions(q) : Promise.resolve(setSuggestions([])),
    ]);

    setRefreshing(false);
  };

  const submitAsk = async () => {
    try {
      setAsking(true);

      const q = askQuestion.trim();
      if (!q) {
        showToast("Missing info", "Please write your question.");
        return;
      }

      const res = await fetchWithAuth("http://10.0.2.2:8000/api/explore/ask/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ plant_name: askPlant.trim(), question: q }),
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw);

      setAskOpen(false);
      setAskPlant("");
      setAskQuestion("");
      showToast("Sent", "Your question was sent to experts.");
    } catch (e: any) {
      showToast("Error", e?.message || "Failed to send question");
    } finally {
      setAsking(false);
    }
  };

  const submitPost = async () => {
    try {
      setPublishing(true);

      const t = postTitle.trim();
      const c = postContent.trim();

      if (!t || !c) {
        showToast("Missing info", "Please add a title and content.");
        return;
      }

      const res = await fetchWithAuth("http://10.0.2.2:8000/api/explore/posts/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ title: t, content: c, image_url: postImageUrl.trim() || null }),
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw);

      setCreateOpen(false);
      setPostTitle("");
      setPostContent("");
      setPostImageUrl("");
      showToast("Published", "Your post is live on Explore.");

      const q = query.trim();
      await loadPosts(q ? q : undefined);
    } catch (e: any) {
      showToast("Error", e?.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const openPost = (post: ExpertPost) => {
    setActivePost(post);
    setPostOpen(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loadingText}>Loading Explore...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#f9faf9", "#e8f0eb", "#dae7df"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Explore</Text>
              <Text style={styles.subtitle}>{headerSubtitle}</Text>
            </View>

            <View style={styles.headerActions}>
              {/* Bell for everyone */}
              <Pressable onPress={() => router.push("/NotificationsScreen" as any)} style={styles.bellBtn}>
                <Feather name="bell" size={18} color="#2e4d35" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                  </View>
                )}
              </Pressable>

              {/* User: Ask Expert */}
              {!isExpert && (
                <Pressable onPress={() => setAskOpen(true)} style={styles.primaryBtn}>
                  <Feather name="help-circle" size={16} color="#fff" />
                  <Text style={styles.primaryText}>Ask</Text>
                </Pressable>
              )}

              {/* Expert: Inbox */}
              {isExpert && (
                <Pressable onPress={() => router.push("/ExpertInboxScreen" as any)} style={styles.inboxBtn}>
                  <Feather name="inbox" size={16} color="#2e4d35" />
                  <Text style={styles.inboxText}>Inbox</Text>
                </Pressable>
              )}

              {/* Expert: Publish */}
              {isExpert && (
                <Pressable onPress={() => setCreateOpen(true)} style={styles.publishFab}>
                  <Feather name="plus" size={18} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#2e4d35" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search plants or topics..."
              placeholderTextColor="#7aa68a"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            {searching ? <ActivityIndicator size="small" color="#2e4d35" /> : null}

            {query.length > 0 && !searching ? (
              <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
                <Feather name="x" size={16} color="#2e4d35" />
              </Pressable>
            ) : null}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.empty}>
              <Feather name="alert-triangle" size={22} color="#b91c1c" />
              <Text style={styles.emptyTitle}>Couldn’t load Explore</Text>
              <Text style={styles.emptyText}>{error}</Text>

              <Pressable style={styles.retryBtn} onPress={() => loadPosts(query.trim() || undefined)}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 14, paddingBottom: 22 }}
              refreshing={refreshing}
              onRefresh={onRefresh}
              ListHeaderComponent={
                query.trim().length > 0 && suggestions.length > 0 ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.sectionTitle}>Plant matches</Text>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
                    >
                      {suggestions.slice(0, 10).map((item: any, idx: number) => {
                        const img = item.image || item.image_url || item.imageUrl;
                        const name = item.name || item.common_name || "Plant";

                        return (
                          <View key={String(item?.id ?? item?.name ?? idx)} style={styles.suggestCard}>
                            {img ? <Image source={{ uri: img }} style={styles.suggestImg} /> : null}
                            <Text style={styles.suggestName} numberOfLines={1}>
                              {name}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Feather name="compass" size={22} color="#3e7c52" />
                  <Text style={styles.emptyTitle}>No posts yet</Text>
                  <Text style={styles.emptyText}>
                    {isExpert ? "Publish your first post to start helping!" : "Check back soon for expert tips."}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.postCard} onPress={() => openPost(item)} android_ripple={{ color: "#00000010" }}>
                  {/* Image only if provided */}
                  {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.postImage} /> : null}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.postTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.postMeta} numberOfLines={1}>
                      {item.author_username ? `By ${item.author_username}` : "Expert"}{" "}
                      {item.created_at ? `  •  ${new Date(item.created_at).toLocaleDateString()}` : ""}
                    </Text>
                    <Text style={styles.postSnippet} numberOfLines={3}>
                      {item.content}
                    </Text>

                    <View style={styles.readRow}>
                      <Text style={styles.readText}>Read</Text>
                      <Feather name="chevron-right" size={16} color="#2e4d35" />
                    </View>
                  </View>
                </Pressable>
              )}
            />
          )}

          {/* Ask Expert Modal */}
          <Modal visible={askOpen} transparent animationType="fade" onRequestClose={() => setAskOpen(false)}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Ask an Expert</Text>
                    <Pressable onPress={() => setAskOpen(false)} style={styles.iconBtn}>
                      <Feather name="x" size={18} color="#2e4d35" />
                    </Pressable>
                  </View>

                  <Text style={styles.modalHint}>Optional: add a plant name</Text>
                  <TextInput
                    value={askPlant}
                    onChangeText={setAskPlant}
                    placeholder="Plant name (optional)"
                    placeholderTextColor="#7aa68a"
                    style={styles.input}
                  />

                  <Text style={[styles.modalHint, { marginTop: 10 }]}>Your question</Text>
                  <TextInput
                    value={askQuestion}
                    onChangeText={setAskQuestion}
                    placeholder="Write your question..."
                    placeholderTextColor="#7aa68a"
                    style={[styles.input, { height: 110, textAlignVertical: "top" }]}
                    multiline
                  />

                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setAskOpen(false)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </Pressable>

                    <Pressable onPress={submitAsk} style={styles.primaryBtnWide} disabled={asking}>
                      {asking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Send</Text>}
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* Create Post Modal */}
          <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Publish Post</Text>
                    <Pressable onPress={() => setCreateOpen(false)} style={styles.iconBtn}>
                      <Feather name="x" size={18} color="#2e4d35" />
                    </Pressable>
                  </View>

                  <Text style={styles.modalHint}>Title</Text>
                  <TextInput
                    value={postTitle}
                    onChangeText={setPostTitle}
                    placeholder="Short title..."
                    placeholderTextColor="#7aa68a"
                    style={styles.input}
                  />

                  <Text style={[styles.modalHint, { marginTop: 10 }]}>Content</Text>
                  <TextInput
                    value={postContent}
                    onChangeText={setPostContent}
                    placeholder="Write your post..."
                    placeholderTextColor="#7aa68a"
                    style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                    multiline
                  />

                  <Text style={[styles.modalHint, { marginTop: 10 }]}>Image URL (optional)</Text>
                  <TextInput
                    value={postImageUrl}
                    onChangeText={setPostImageUrl}
                    placeholder="https://..."
                    placeholderTextColor="#7aa68a"
                    style={styles.input}
                    autoCapitalize="none"
                  />

                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setCreateOpen(false)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </Pressable>

                    <Pressable onPress={submitPost} style={styles.primaryBtnWide} disabled={publishing}>
                      {publishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Publish</Text>}
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* View Post Modal */}
          <Modal visible={postOpen} transparent animationType="fade" onRequestClose={() => setPostOpen(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: "80%" }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{activePost?.title || "Post"}</Text>
                  <Pressable onPress={() => setPostOpen(false)} style={styles.iconBtn}>
                    <Feather name="x" size={18} color="#2e4d35" />
                  </Pressable>
                </View>

                {activePost?.image_url ? <Image source={{ uri: activePost.image_url }} style={styles.postModalImage} /> : null}

                <Text style={styles.postModalMeta}>
                  {activePost?.author_username ? `By ${activePost.author_username}` : "Expert"}
                </Text>

                <Text style={styles.postModalBody}>{activePost?.content || ""}</Text>
              </View>
            </View>
          </Modal>

          {/* Toast */}
          <Modal visible={toastOpen} transparent animationType="fade" onRequestClose={() => setToastOpen(false)}>
            <View style={styles.toastOverlay}>
              <View style={styles.toastCard}>
                <View style={styles.toastHeader}>
                  <Text style={styles.toastTitle}>{toastTitle}</Text>
                  <Pressable onPress={() => setToastOpen(false)} style={styles.iconBtn}>
                    <Feather name="x" size={16} color="#2e4d35" />
                  </Pressable>
                </View>
                <Text style={styles.toastBody}>{toastBody}</Text>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: "#3e7c52", fontWeight: "800" },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },

  title: { fontSize: 24, fontWeight: "900", color: "#2e4d35" },
  subtitle: { marginTop: 4, fontSize: 13.5, color: "#4b9560" },

  // Search
  searchBar: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.18)",
  },
  searchInput: {
    flex: 1,
    color: "#1b4332",
    fontWeight: "800",
  },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,243,220,0.35)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.14)",
  },

  sectionTitle: {
    marginTop: 12,
    fontSize: 13.5,
    fontWeight: "900",
    color: "#2e4d35",
  },
  suggestCard: {
    width: 120,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.12)",
  },
  suggestImg: { width: "100%", height: 70, borderRadius: 14, marginBottom: 8 },
  suggestName: { fontWeight: "900", color: "#2e4d35", fontSize: 12.5 },

  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  primaryBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#2d6a4f",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  inboxBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inboxText: { color: "#2e4d35", fontWeight: "900" },

  publishFab: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    justifyContent: "center",
  },

  postCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.14)",
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  postImage: { width: 78, height: 78, borderRadius: 16 },

  postTitle: { fontSize: 16, fontWeight: "900", color: "#1b4332" },
  postMeta: { marginTop: 4, fontSize: 12.5, color: "#4b9560", fontWeight: "700" },
  postSnippet: { marginTop: 8, fontSize: 13.2, color: "#1f2937", lineHeight: 18 },

  readRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  readText: { color: "#2e4d35", fontWeight: "900" },

  empty: {
    paddingTop: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#2e4d35", textAlign: "center" },
  emptyText: { marginTop: 8, fontSize: 13.2, color: "#4b5563", textAlign: "center", lineHeight: 18 },

  retryBtn: {
    marginTop: 14,
    backgroundColor: "#2d6a4f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  retryText: { color: "#fff", fontWeight: "900" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 18,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.16)",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#2e4d35" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,243,220,0.35)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.14)",
  },
  modalHint: { fontSize: 12.5, color: "#4b9560", fontWeight: "800" },

  input: {
    marginTop: 8,
    backgroundColor: "rgba(248,250,249,1)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.16)",
    color: "#1b4332",
    fontWeight: "800",
  },

  modalActions: { marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#2e4d35", fontWeight: "900" },

  primaryBtnWide: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
  },

  postModalImage: { width: "100%", height: 160, borderRadius: 16, marginTop: 6, marginBottom: 10 },
  postModalMeta: { fontSize: 12.5, color: "#4b9560", fontWeight: "800", marginBottom: 10 },
  postModalBody: { fontSize: 13.8, color: "#111827", lineHeight: 20, fontWeight: "700" },

  toastOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 18,
    justifyContent: "flex-end",
  },
  toastCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.16)",
  },
  toastHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  toastTitle: { fontSize: 14, fontWeight: "900", color: "#2e4d35" },
  toastBody: { fontSize: 13, color: "#374151", fontWeight: "700", lineHeight: 18 },
});
