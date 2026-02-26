import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

type Inquiry = {
  id: number;
  user_username: string;
  plant_name?: string;
  question: string;
  created_at: string;
};

export default function ExpertInboxScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Inquiry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answering, setAnswering] = useState(false);

  async function fetchWithAuth(url: string, options: any = {}) {
    let access = await AsyncStorage.getItem("access");

    let res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${access}` },
    });

    if (res.status === 401) {
      const refresh = await AsyncStorage.getItem("refresh");
      if (refresh) {
        const r = await fetch("http://10.0.2.2:8000/api/users/refresh/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });

        if (r.ok) {
          const j = await r.json();
          await AsyncStorage.setItem("access", j.access);

          res = await fetch(url, {
            ...options,
            headers: { ...(options.headers || {}), Authorization: `Bearer ${j.access}` },
          });
        }
      }
    }

    return res;
  }

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchWithAuth("http://10.0.2.2:8000/api/explore/inbox/", {
        headers: { Accept: "application/json" },
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(`Inbox failed: ${res.status} ${raw}`);

      const data = JSON.parse(raw);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const submitAnswer = async () => {
    if (!selected) return;

    try {
      setAnswering(true);

      const res = await fetchWithAuth(
        `http://10.0.2.2:8000/api/explore/inquiries/${selected.id}/answer/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: answerText.trim() }),
        }
      );

      const raw = await res.text();
      if (!res.ok) throw new Error(`Answer failed: ${res.status} ${raw}`);

      setAnswerOpen(false);
      setSelected(null);
      setAnswerText("");

      // remove from inbox list
      setItems((prev) => prev.filter((x) => x.id !== selected.id));
    } catch (e: any) {
      setError(e?.message || "Could not send answer");
    } finally {
      setAnswering(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loadingText}>Loading inbox...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#f9faf9", "#e8f0eb", "#dae7df"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Feather name="arrow-left" size={18} color="#2e4d35" />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Expert Inbox</Text>
              <Text style={styles.subtitle}>Answer questions from users 💬</Text>
            </View>

            <Pressable onPress={load} style={styles.iconBtn}>
              <Feather name="refresh-cw" size={18} color="#2e4d35" />
            </Pressable>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Feather name="alert-triangle" size={16} color="#b91c1c" />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          )}

          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 22 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="inbox" size={22} color="#3e7c52" />
                <Text style={styles.emptyTitle}>No questions</Text>
                <Text style={styles.emptyText}>When users ask, they’ll appear here.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => {
                  setSelected(item);
                  setAnswerText("");
                  setAnswerOpen(true);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.user_username} {item.plant_name ? `• ${item.plant_name}` : ""}
                  </Text>
                  <Text style={styles.cardBody} numberOfLines={3}>
                    {item.question}
                  </Text>
                  <Text style={styles.cardTime}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>

                <Feather name="chevron-right" size={18} color="#3e7c52" />
              </Pressable>
            )}
          />
        </View>

        {/* Answer modal */}
        <Modal transparent visible={answerOpen} animationType="fade" onRequestClose={() => setAnswerOpen(false)}>
          <View style={styles.modalBackdrop}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Write an answer</Text>

                <View style={styles.qBox}>
                  <Text style={styles.qTitle}>
                    {selected?.user_username} {selected?.plant_name ? `• ${selected.plant_name}` : ""}
                  </Text>
                  <Text style={styles.qText}>{selected?.question}</Text>
                </View>

                <TextInput
                  value={answerText}
                  onChangeText={setAnswerText}
                  placeholder="Your answer..."
                  placeholderTextColor="#7aa68a"
                  style={[styles.input, styles.textArea]}
                  multiline
                />

                <View style={styles.modalActions}>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setAnswerOpen(false)} disabled={answering}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.btn, styles.btnPrimary, answering && { opacity: 0.85 }]}
                    onPress={submitAnswer}
                    disabled={answering || answerText.trim().length === 0}
                  >
                    <Text style={styles.btnPrimaryText}>{answering ? "Sending..." : "Send"}</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: "#3e7c52", fontWeight: "800" },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(95,156,108,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontSize: 22, fontWeight: "900", color: "#2e4d35" },
  subtitle: { marginTop: 2, fontSize: 13, color: "#4b9560" },

  errorBox: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(185,28,28,0.18)",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  errorText: { flex: 1, color: "#7f1d1d", fontWeight: "800", fontSize: 12.5 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffffdd",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.12)",
  },
  cardTitle: { fontSize: 15.5, fontWeight: "900", color: "#2e4d35" },
  cardBody: { marginTop: 6, fontSize: 13.5, color: "#2e4d35", lineHeight: 18 },
  cardTime: { marginTop: 8, fontSize: 12, color: "#4b9560" },

  empty: {
    marginTop: 30,
    alignItems: "center",
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#ffffffcc",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.12)",
  },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#2e4d35" },
  emptyText: { marginTop: 6, fontSize: 13, color: "#4b9560", textAlign: "center" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 18,
    alignItems: "center",
  },
  modalCard: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.12)",
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#1b4332" },

  qBox: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(216,243,220,0.35)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.14)",
  },
  qTitle: { fontWeight: "900", color: "#1b4332" },
  qText: { marginTop: 6, color: "#2e4d35", lineHeight: 18, fontWeight: "700" },

  input: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(216,243,220,0.35)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.14)",
    color: "#1b4332",
    fontWeight: "700",
  },
  textArea: { minHeight: 120, textAlignVertical: "top" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnGhost: {
    backgroundColor: "rgba(45,106,79,0.08)",
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.16)",
  },
  btnGhostText: { fontWeight: "900", color: "#1b4332" },
  btnPrimary: { backgroundColor: "#2d6a4f" },
  btnPrimaryText: { fontWeight: "900", color: "white" },
});
