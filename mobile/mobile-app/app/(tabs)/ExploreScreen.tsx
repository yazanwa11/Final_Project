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
import { useTranslation } from 'react-i18next';

type ExpertPost = {
  id: number;
  title: string;
  content: string;
  image_url?: string | null;
  author_username?: string;
  created_at?: string;
};

export default function ExploreScreen() {
  const { t } = useTranslation();
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
    if (!user) return t('explore.subtitleGuest');
    if (isExpert) return t('explore.subtitleExpert');
    return t('explore.subtitleUser');
  }, [user, isExpert, t]);

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
      if (!res.ok) throw new Error(t('explore.feedLoadError', { status: res.status }));

      const data = JSON.parse(raw);
      setPosts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setPosts([]);
      setError(e?.message || t('explore.loadFailed'));
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
        showToast(t('explore.missingInfo'), t('explore.pleaseWriteQuestion'));
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
      showToast(t('explore.sent'), t('explore.questionSentToExperts'));
    } catch (e: any) {
      showToast(t('common.error'), e?.message || t('explore.failedToSendQuestion'));
    } finally {
      setAsking(false);
    }
  };

  const submitPost = async () => {
    try {
      setPublishing(true);

      const title = postTitle.trim();
      const content = postContent.trim();

      if (!title || !content) {
        showToast(t('explore.missingInfo'), t('explore.pleaseAddTitleContent'));
        return;
      }

      const res = await fetchWithAuth("http://10.0.2.2:8000/api/explore/posts/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ title: title, content: content, image_url: postImageUrl.trim() || null }),
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw);

      setCreateOpen(false);
      setPostTitle("");
      setPostContent("");
      setPostImageUrl("");
      showToast(t('explore.published'), t('explore.postIsLive'));

      const q = query.trim();
      await loadPosts(q ? q : undefined);
    } catch (e: any) {
      showToast(t('common.error'), e?.message || t('explore.failedToPublish'));
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
        <Text style={styles.loadingText}>{t('explore.loadingExplore')}</Text>
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
              <Text style={styles.title}>{t('explore.title')}</Text>
              <Text style={styles.subtitle}>{headerSubtitle}</Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push("/AssistantScreen" as any)} style={styles.inboxBtn}>
                <Feather name="message-circle" size={16} color="#2e4d35" />
                <Text style={styles.inboxText}>{t('explore.ai')}</Text>
              </Pressable>

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
                  <Text style={styles.primaryText}>{t('explore.ask')}</Text>
                </Pressable>
              )}

              {/* Expert: Inbox */}
              {isExpert && (
                <Pressable onPress={() => router.push("/ExpertInboxScreen" as any)} style={styles.inboxBtn}>
                  <Feather name="inbox" size={16} color="#2e4d35" />
                  <Text style={styles.inboxText}>{t('explore.inbox')}</Text>
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
              placeholder={t('explore.searchPlaceholder')}
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
              <Text style={styles.emptyTitle}>{t('explore.couldntLoad')}</Text>
              <Text style={styles.emptyText}>{error}</Text>

              <Pressable style={styles.retryBtn} onPress={() => loadPosts(query.trim() || undefined)}>
                <Text style={styles.retryText}>{t('explore.tryAgain')}</Text>
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
                    <Text style={styles.sectionTitle}>{t('explore.plantMatches')}</Text>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingVertical: 10, gap: 10 }}
                    >
                      {suggestions.slice(0, 10).map((item: any, idx: number) => {
                        const img = item.image || item.image_url || item.imageUrl;
                        const name = item.name || item.common_name || t('explore.plant');

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
                  <Text style={styles.emptyTitle}>{t('explore.noPostsYet')}</Text>
                  <Text style={styles.emptyText}>
                    {isExpert ? t('explore.publishFirstPost') : t('explore.checkBackSoon')}
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
                      {item.author_username ? `${t('explore.by')} ${item.author_username}` : t('explore.expert')}{" "}
                      {item.created_at ? `  •  ${new Date(item.created_at).toLocaleDateString()}` : ""}
                    </Text>
                    <Text style={styles.postSnippet} numberOfLines={3}>
                      {item.content}
                    </Text>

                    <View style={styles.readRow}>
                      <Text style={styles.readText}>{t('explore.read')}</Text>
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
                    <Text style={styles.modalTitle}>{t('explore.askAnExpert')}</Text>
                    <Pressable onPress={() => setAskOpen(false)} style={styles.iconBtn}>
                      <Feather name="x" size={18} color="#2e4d35" />
                    </Pressable>
                  </View>

                  <Text style={styles.modalHint}>{t('explore.optionalPlantName')}</Text>
                  <TextInput
                    value={askPlant}
                    onChangeText={setAskPlant}
                    placeholder={t('explore.plantNameOptional')}
                    placeholderTextColor="#7aa68a"
                    style={styles.input}
                  />

                  <Text style={[styles.modalHint, { marginTop: 10 }]}>{t('explore.yourQuestion')}</Text>
                  <TextInput
                    value={askQuestion}
                    onChangeText={setAskQuestion}
                    placeholder={t('explore.writeQuestion')}
                    placeholderTextColor="#7aa68a"
                    style={[styles.input, { height: 110, textAlignVertical: "top" }]}
                    multiline
                  />

                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setAskOpen(false)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                    </Pressable>

                    <Pressable onPress={submitAsk} style={styles.primaryBtnWide} disabled={asking}>
                      {asking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('explore.send')}</Text>}
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
                    <Text style={styles.modalTitle}>{t('explore.publishPost')}</Text>
                    <Pressable onPress={() => setCreateOpen(false)} style={styles.iconBtn}>
                      <Feather name="x" size={18} color="#2e4d35" />
                    </Pressable>
                  </View>

                  <Text style={styles.modalHint}>{t('explore.titleLabel')}</Text>
                  <TextInput
                    value={postTitle}
                    onChangeText={setPostTitle}
                    placeholder={t('explore.shortTitle')}
                    placeholderTextColor="#7aa68a"
                    style={styles.input}
                  />

                  <Text style={[styles.modalHint, { marginTop: 10 }]}>{t('explore.contentLabel')}</Text>
                  <TextInput
                    value={postContent}
                    onChangeText={setPostContent}
                    placeholder={t('explore.writePost')}
                    placeholderTextColor="#7aa68a"
                    style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                    multiline
                  />

                  <Text style={[styles.modalHint, { marginTop: 10 }]}>{t('explore.imageUrlOptional')}</Text>
                  <TextInput
                    value={postImageUrl}
                    onChangeText={setPostImageUrl}
                    placeholder={t('explore.imageUrlPlaceholder')}
                    placeholderTextColor="#7aa68a"
                    style={styles.input}
                    autoCapitalize="none"
                  />

                  <View style={styles.modalActions}>
                    <Pressable onPress={() => setCreateOpen(false)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                    </Pressable>

                    <Pressable onPress={submitPost} style={styles.primaryBtnWide} disabled={publishing}>
                      {publishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('explore.publish')}</Text>}
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
                  <Text style={styles.modalTitle}>{activePost?.title || t('explore.post')}</Text>
                  <Pressable onPress={() => setPostOpen(false)} style={styles.iconBtn}>
                    <Feather name="x" size={18} color="#2e4d35" />
                  </Pressable>
                </View>

                {activePost?.image_url ? <Image source={{ uri: activePost.image_url }} style={styles.postModalImage} /> : null}

                <Text style={styles.postModalMeta}>
                  {activePost?.author_username ? `${t('explore.by')} ${activePost.author_username}` : t('explore.expert')}
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#2d6a4f", fontSize: 16, fontWeight: "800" },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },

  title: { fontSize: 28, fontWeight: "900", color: "#1b4332", letterSpacing: -0.5 },
  subtitle: { marginTop: 6, fontSize: 15, color: "#52b788", fontWeight: "600" },

  // Search
  searchBar: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.4)",
  },
  searchInput: {
    flex: 1,
    color: "#1b4332",
    fontSize: 16,
    fontWeight: "600",
  },
  clearBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.15)",
  },

  sectionTitle: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "900",
    color: "#1b4332",
    letterSpacing: -0.2,
  },
  suggestCard: {
    width: 130,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(212,241,223,0.3)",
  },
  suggestImg: { width: "100%", height: 75, borderRadius: 14, marginBottom: 10 },
  suggestName: { fontWeight: "800", color: "#1b4332", fontSize: 14 },

  bellBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.4)",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2.5,
    borderColor: "#ffffff",
    shadowColor: "#ef4444",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  primaryBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#2d6a4f",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  inboxBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.4)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inboxText: { color: "#1b4332", fontWeight: "900", fontSize: 16 },

  publishFab: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },

  postCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(212,241,223,0.3)",
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
  },
  postImage: { width: 85, height: 85, borderRadius: 18 },

  postTitle: { fontSize: 17, fontWeight: "900", color: "#1b4332", letterSpacing: -0.2 },
  postMeta: { marginTop: 5, fontSize: 13, color: "#52b788", fontWeight: "600" },
  postSnippet: { marginTop: 10, fontSize: 14, color: "#2d6a4f", lineHeight: 20, fontWeight: "500" },

  readRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  readText: { color: "#1b4332", fontWeight: "800", fontSize: 15 },

  empty: {
    paddingTop: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "900", color: "#1b4332", textAlign: "center" },
  emptyText: { marginTop: 10, fontSize: 15, color: "#52b788", textAlign: "center", lineHeight: 22 },

  retryBtn: {
    marginTop: 18,
    backgroundColor: "#2d6a4f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,30,20,0.5)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#1b4332", letterSpacing: -0.5 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,240,235,0.6)",
  },
  modalHint: { fontSize: 14, color: "#52b788", fontWeight: "700", marginBottom: 8 },

  input: {
    marginTop: 12,
    backgroundColor: "#f8faf9",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "rgba(45,106,79,0.2)",
    color: "#1b4332",
    fontSize: 16,
    fontWeight: "600",
  },

  modalActions: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#f8faf9",
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#1b4332", fontWeight: "900", fontSize: 16 },

  primaryBtnWide: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  postModalImage: { width: "100%", height: 180, borderRadius: 18, marginTop: 8, marginBottom: 12 },
  postModalMeta: { fontSize: 14, color: "#52b788", fontWeight: "700", marginBottom: 12 },
  postModalBody: { fontSize: 16, color: "#1b4332", lineHeight: 24, fontWeight: "500" },

  toastOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,30,20,0.4)",
    padding: 20,
    justifyContent: "flex-end",
  },
  toastCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  toastTitle: { fontSize: 17, fontWeight: "900", color: "#1b4332" },
  toastBody: { fontSize: 15, color: "#2d6a4f", fontWeight: "600", lineHeight: 22 },
});
