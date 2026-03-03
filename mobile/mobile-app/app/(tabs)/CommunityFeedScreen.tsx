import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  I18nManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  FeedPost,
  createFeedPost,
  deleteFeedPost,
  listFeedPosts,
  toggleLike,
  updateFeedPost,
} from "../../services/feedApi";

function formatPostDate(value: string) {
  const created = new Date(value);
  return created.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLocalImage(uri?: string | null) {
  if (!uri) return false;
  return uri.startsWith("file:") || uri.startsWith("content:");
}

export default function CommunityFeedScreen() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "he" || I18nManager.isRTL;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftImageUri, setDraftImageUri] = useState<string | null>(null);
  const [draftRemoveImage, setDraftRemoveImage] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);

  const titleText = useMemo(() => (editingPost ? "Edit Post" : "Create Post"), [editingPost]);

  const loadPosts = async () => {
    try {
      setError(null);
      const data = await listFeedPosts();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load feed");
    }
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        await loadPosts();
        setLoading(false);
      })();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditingPost(null);
    setDraftText("");
    setDraftImageUri(null);
    setDraftRemoveImage(false);
    setComposerOpen(true);
  };

  const openEdit = (post: FeedPost) => {
    setEditingPost(post);
    setDraftText(post.text || "");
    setDraftImageUri(post.image_url || null);
    setDraftRemoveImage(false);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (submitting) return;
    setComposerOpen(false);
    setEditingPost(null);
    setDraftText("");
    setDraftImageUri(null);
    setDraftRemoveImage(false);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow gallery access to add a photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setDraftImageUri(asset.uri);
    setDraftRemoveImage(false);
  };

  const clearImage = () => {
    setDraftImageUri(null);
    setDraftRemoveImage(true);
  };

  const submitComposer = async () => {
    const text = draftText.trim();
    if (!text) {
      Alert.alert("Missing text", "Please write something before posting.");
      return;
    }

    try {
      setSubmitting(true);

      if (editingPost) {
        const updated = await updateFeedPost(editingPost.id, text, {
          imageUri: isLocalImage(draftImageUri) ? draftImageUri : undefined,
          removeImage: draftRemoveImage,
        });

        setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createFeedPost(text, draftImageUri || undefined);
        setPosts((prev) => [created, ...prev]);
      }

      closeComposer();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not save post");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = (post: FeedPost) => {
    Alert.alert("Delete post", "Are you sure you want to remove this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFeedPost(post.id);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Could not delete post");
          }
        },
      },
    ]);
  };

  const onToggleLike = async (post: FeedPost) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              is_liked: !p.is_liked,
              likes_count: p.is_liked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
            }
          : p
      )
    );

    try {
      const result = await toggleLike(post.id);
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_liked: result.liked, likes_count: result.likes_count } : p))
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                is_liked: !p.is_liked,
                likes_count: p.is_liked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
              }
            : p
        )
      );
    }
  };

  const renderCard = ({ item }: { item: FeedPost }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.authorWrap}>
          {item.author_avatar ? (
            <Image source={{ uri: item.author_avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{item.author_username?.[0]?.toUpperCase() || "U"}</Text>
            </View>
          )}

          <View>
            <Text style={styles.authorName}>{item.author_username}</Text>
            <Text style={styles.postDate}>{formatPostDate(item.created_at)}</Text>
          </View>
        </View>

        {item.can_edit && (
          <View style={styles.ownActions}>
            <Pressable style={styles.smallActionBtn} onPress={() => openEdit(item)}>
              <Feather name="edit-2" size={14} color="#1f5138" />
            </Pressable>
            <Pressable style={styles.smallActionBtn} onPress={() => onDelete(item)}>
              <Feather name="trash-2" size={14} color="#8a2d2d" />
            </Pressable>
          </View>
        )}
      </View>

      <Text style={[styles.postText, isRtl && { textAlign: "right", writingDirection: "rtl" }]}>{item.text}</Text>

      {!!item.image_url && <Image source={{ uri: item.image_url }} style={styles.postImage} resizeMode="cover" />}

      <View style={styles.cardFooter}>
        <Pressable style={styles.likeBtn} onPress={() => onToggleLike(item)}>
          <Feather name="heart" size={16} color={item.is_liked ? "#d14b6a" : "#3f5f4a"} />
          <Text style={[styles.likeText, item.is_liked && { color: "#d14b6a" }]}>{item.likes_count}</Text>
        </Pressable>

        <Text style={styles.updatedText}>{item.updated_at !== item.created_at ? "edited" : ""}</Text>
      </View>
    </View>
  );

  return (
    <LinearGradient colors={["#f8fbf9", "#edf5ef", "#dfece3"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Community Feed</Text>
              <Text style={styles.subtitle}>Share your plant journey with everyone.</Text>
            </View>

            <Pressable style={styles.newPostBtn} onPress={openCreate}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.newPostText}>New</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#2d6a4f" />
              <Text style={styles.loadingText}>Loading feed...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerWrap}>
              <Text style={styles.errorTitle}>Couldn’t load feed</Text>
              <Text style={styles.errorBody}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={loadPosts}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d6a4f" />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="image" size={28} color="#6b8f78" />
                  <Text style={styles.emptyTitle}>No posts yet</Text>
                  <Text style={styles.emptyBody}>Be the first to share a photo and story.</Text>
                </View>
              }
            />
          )}
        </View>

        <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={closeComposer}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{titleText}</Text>
                <Pressable onPress={closeComposer}>
                  <Feather name="x" size={20} color="#345842" />
                </Pressable>
              </View>

              <TextInput
                value={draftText}
                onChangeText={setDraftText}
                placeholder="Write something about your plant..."
                placeholderTextColor="#7c9a87"
                multiline
                style={[styles.textInput, isRtl && styles.textInputRtl]}
                textAlignVertical="top"
                autoCorrect
                autoCapitalize="sentences"
                textAlign={isRtl ? "right" : "left"}
                writingDirection={isRtl ? "rtl" : "ltr"}
              />

              {draftImageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: draftImageUri }} style={styles.previewImage} />
                  <Pressable style={styles.removePreviewBtn} onPress={clearImage}>
                    <Feather name="trash-2" size={14} color="#8a2d2d" />
                    <Text style={styles.removePreviewText}>Remove image</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.addImageBtn} onPress={pickImage}>
                  <Feather name="image" size={16} color="#2c5f46" />
                  <Text style={styles.addImageText}>Add image</Text>
                </Pressable>
              )}

              <Pressable style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={submitComposer} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#fff" />
                    <Text style={styles.submitText}>{editingPost ? "Save changes" : "Share post"}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#193d2c",
  },
  subtitle: {
    marginTop: 4,
    color: "#5f7f6d",
    fontSize: 13,
  },
  newPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2d6a4f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  newPostText: {
    color: "#fff",
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e4eee7",
    shadowColor: "#143225",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  authorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#dbe9df",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontWeight: "800",
    color: "#2c5e45",
  },
  authorName: {
    fontWeight: "700",
    color: "#1d3f2e",
    fontSize: 14,
  },
  postDate: {
    color: "#779280",
    fontSize: 12,
    marginTop: 1,
  },
  ownActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#eff6f1",
    alignItems: "center",
    justifyContent: "center",
  },
  postText: {
    color: "#2e4b3a",
    lineHeight: 21,
    fontSize: 15,
  },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: "#e5efe8",
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f2f7f4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  likeText: {
    color: "#3f5f4a",
    fontWeight: "700",
  },
  updatedText: {
    color: "#7f9888",
    fontSize: 12,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#537562",
  },
  errorTitle: {
    fontWeight: "800",
    color: "#244937",
    fontSize: 18,
  },
  errorBody: {
    color: "#6d8577",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    backgroundColor: "#2d6a4f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 42,
    gap: 8,
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#315642",
    fontSize: 17,
  },
  emptyBody: {
    color: "#6d8c79",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 24, 18, 0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#f9fcfa",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    borderWidth: 1,
    borderColor: "#e0ece4",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#204634",
  },
  textInput: {
    minHeight: 120,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#d8e8de",
    borderRadius: 14,
    padding: 12,
    color: "#274636",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  textInputRtl: {
    fontWeight: "500",
  },
  addImageBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfe1d6",
    backgroundColor: "#eef6f1",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addImageText: {
    color: "#2d5f45",
    fontWeight: "700",
  },
  previewWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d6e6dd",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 190,
  },
  removePreviewBtn: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f6f8f7",
  },
  removePreviewText: {
    color: "#8a2d2d",
    fontWeight: "700",
  },
  submitBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});