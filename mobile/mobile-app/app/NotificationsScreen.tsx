import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: any;
};

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notif[]>([]);
  const [busy, setBusy] = useState(false);

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
      const res = await fetchWithAuth("http://10.0.2.2:8000/api/notifications/", {
        headers: { Accept: "application/json" },
      });

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
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

  const markOne = async (id: number) => {
    try {
      await fetchWithAuth(`http://10.0.2.2:8000/api/notifications/${id}/read/`, {
        method: "POST",
      });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  const markAll = async () => {
    try {
      setBusy(true);
      await fetchWithAuth("http://10.0.2.2:8000/api/notifications/read-all/", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <LinearGradient colors={["#f9faf9", "#e8f0eb", "#dae7df"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Feather name="arrow-left" size={18} color="#2e4d35" />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Notifications</Text>
              <Text style={styles.subtitle}>
                {unread > 0 ? `${unread} unread` : "All caught up ✨"}
              </Text>
            </View>

            <Pressable onPress={markAll} style={[styles.markAllBtn, busy && { opacity: 0.8 }]} disabled={busy}>
              <Feather name="check-circle" size={16} color="white" />
              <Text style={styles.markAllText}>{busy ? "..." : "Read all"}</Text>
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 22 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="bell-off" size={22} color="#3e7c52" />
                <Text style={styles.emptyTitle}>No notifications</Text>
                <Text style={styles.emptyText}>When experts post or reply, you’ll see it here.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => markOne(item.id)}
                style={[styles.card, !item.is_read && styles.cardUnread]}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.dot, !item.is_read && styles.dotOn]} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title || "Notification"}
                  </Text>
                  <Text style={styles.cardBody} numberOfLines={2}>
                    {item.body || ""}
                  </Text>
                  <Text style={styles.cardTime}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                  </Text>
                </View>

                <Feather name="chevron-right" size={18} color="#3e7c52" />
              </Pressable>
            )}
          />
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

  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#2E7D32",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  markAllText: { color: "white", fontWeight: "900" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffffdd",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(45,106,79,0.12)",
  },
  cardUnread: {
    borderColor: "rgba(46,125,50,0.35)",
    backgroundColor: "rgba(255,255,255,0.95)",
  },

  cardLeft: { width: 10, alignItems: "center" },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "rgba(46,125,50,0.15)",
  },
  dotOn: { backgroundColor: "#2E7D32" },

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
});
