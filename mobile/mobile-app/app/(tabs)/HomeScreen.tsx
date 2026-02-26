// FULL FINAL HOME SCREEN WITH SMART TASKS (WHITE + MINT THEME)

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Image,
  Easing,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

// =========================================================
// UTILITIES
// =========================================================

const DAY = 86400000;

function timeRemaining(timestamp: number) {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff <= 0) return { text: "Overdue", overdue: true };

  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;

  if (days > 0) return { text: `${days}d ${hours}h`, overdue: false };
  if (hours > 0) return { text: `${hours}h ${minutes}m`, overdue: false };
  return { text: `${minutes}m`, overdue: false };
}

function isToday(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isTomorrow(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  return (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear()
  );
}

// =========================================================
// HOME SCREEN
// =========================================================

export default function HomeScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [plants, setPlants] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // =========================================================
  // LOAD USER + PLANTS + NOTIFICATIONS
  // =========================================================

  useFocusEffect(
    React.useCallback(() => {
      loadUser();
      loadPlants();
      loadUnread();
    }, [])
  );

  const loadUser = async () => {
    const token = await AsyncStorage.getItem("access");
    if (!token) return;

    const res = await fetch("http://10.0.2.2:8000/api/users/me/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setUser(await res.json());
  };

  const loadPlants = async () => {
    const token = await AsyncStorage.getItem("access");
    if (!token) return;

    const res = await fetch("http://10.0.2.2:8000/api/plants/", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;

    const data = await res.json();
    setPlants(data);
    buildTasks(data);
  };

  const loadUnread = async () => {
    try {
      const token = await AsyncStorage.getItem("access");
      if (!token) return;

      const res = await fetch("http://10.0.2.2:8000/api/notifications/", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!res.ok) {
        setUnreadCount(0);
        return;
      }

      const data = await res.json();
      const unread = Array.isArray(data) ? data.filter((n: any) => !n.is_read).length : 0;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  };

  // =========================================================
  // BUILD ACCURATE TASKS
  // =========================================================

  const buildTasks = (plants: any[]) => {
    const list: any[] = [];
    const now = Date.now();

    plants.forEach((p) => {
      // WATERING
      if (p.last_watered) {
        const last = new Date(p.last_watered).getTime();
        let nextWater = last + p.watering_interval * DAY;

        // If backend next_watering_date is valid and in the future use it
        if (p.next_watering_date) {
          const backendDate = new Date(p.next_watering_date).getTime();
          if (backendDate > now) nextWater = backendDate;
        }

        list.push({
          plantId: p.id,
          name: p.name,
          type: "Water",
          icon: "droplet",
          timestamp: nextWater,
          ...timeRemaining(nextWater),
        });
      }

      // SUNLIGHT
      if (p.last_sunlight) {
        const last = new Date(p.last_sunlight).getTime();
        let nextSun = last + p.sunlight_interval * DAY;

        if (p.next_sunlight_date) {
          const backendDate = new Date(p.next_sunlight_date).getTime();
          if (backendDate > now) nextSun = backendDate;
        }

        list.push({
          plantId: p.id,
          name: p.name,
          type: "Sunlight",
          icon: "sun",
          timestamp: nextSun,
          ...timeRemaining(nextSun),
        });
      }
    });

    // Sort by urgency
    list.sort((a, b) => a.timestamp - b.timestamp);

    setTasks(list);
  };

  // =========================================================
  // ANIMATIONS
  // =========================================================

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // =========================================================
  // GROUP TASKS
  // =========================================================

  const overdue = tasks.filter((t) => t.overdue);
  const todayTasks = tasks.filter((t) => !t.overdue && isToday(t.timestamp));
  const tomorrowTasks = tasks.filter((t) => isTomorrow(t.timestamp));
  const laterTasks = tasks.filter(
    (t) => !t.overdue && !isToday(t.timestamp) && !isTomorrow(t.timestamp)
  );

  const mostUrgent = tasks.length > 0 ? tasks[0] : null;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#f9faf9", "#e8f0eb", "#dae7df"]}
        style={styles.background}
      >
        <StatusBar barStyle="dark-content" translucent />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* HEADER CARD */}
          <Animated.View
            style={[
              styles.heroCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <LinearGradient
              colors={["#cde4d3", "#f0f5f1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.date}>{today}</Text>
                  <Text style={styles.greeting}>
                    Welcome,
                    <Text style={styles.username}> {user?.username || "Buddy"} 🌿</Text>
                  </Text>
                </View>

                <View style={styles.headerRight}>
                  {/* Notifications */}
                  <TouchableOpacity
                    style={styles.bellBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push("/NotificationsScreen" as any)}
                  >
                    <Feather name="bell" size={18} color="#2e4d35" />
                    {unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Avatar */}
                  <TouchableOpacity
                    onPress={() => router.push("(tabs)/ProfileScreen" as any)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{
                        uri:
                          user?.avatar && user.avatar !== "null"
                            ? user.avatar
                            : "https://cdn-icons-png.flaticon.com/512/219/219969.png",
                      }}
                      style={styles.avatar}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* SUMMARY SECTION */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>🌱 Plants: {plants.length}</Text>
            <Text style={styles.summaryText}>💧 Tasks: {tasks.length}</Text>
            <Text style={styles.summaryText}>⏰ Overdue: {overdue.length}</Text>
          </View>

          {/* MOST URGENT TASK */}
          {mostUrgent && (
            <View style={styles.taskHighlight}>
              <Text style={styles.sectionTitle}>Most Urgent</Text>

              <View style={styles.taskCard}>
                <Feather
                  name={mostUrgent.icon}
                  size={24}
                  color="#3e7c52"
                  style={{ marginRight: 10 }}
                />
                <View>
                  <Text style={styles.taskName}>
                    {mostUrgent.type} — {mostUrgent.name}
                  </Text>
                  <Text
                    style={[
                      styles.taskTime,
                      mostUrgent.overdue && { color: "#b91c1c" },
                    ]}
                  >
                    {mostUrgent.overdue ? "Overdue" : `In ${mostUrgent.text}`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* UPCOMING TASKS SECTIONS */}
          {overdue.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Overdue</Text>
              {overdue.map((t, i) => (
                <View key={i} style={styles.taskItemOverdue}>
                  <Feather name={t.icon} size={20} color="#b91c1c" />
                  <Text style={styles.taskName}>
                    {t.type} — {t.name}
                  </Text>
                  <Text style={styles.taskOverdue}>Overdue</Text>
                </View>
              ))}
            </>
          )}

          {todayTasks.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Today</Text>
              {todayTasks.map((t, i) => (
                <View key={i} style={styles.taskItem}>
                  <Feather name={t.icon} size={20} color="#3e7c52" />
                  <Text style={styles.taskName}>
                    {t.type} — {t.name}
                  </Text>
                  <Text style={styles.taskTime}>In {t.text}</Text>
                </View>
              ))}
            </>
          )}

          {tomorrowTasks.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Tomorrow</Text>
              {tomorrowTasks.map((t, i) => (
                <View key={i} style={styles.taskItem}>
                  <Feather name={t.icon} size={20} color="#3e7c52" />
                  <Text style={styles.taskName}>
                    {t.type} — {t.name}
                  </Text>
                  <Text style={styles.taskTime}>In {t.text}</Text>
                </View>
              ))}
            </>
          )}

          {laterTasks.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Later</Text>
              {laterTasks.map((t, i) => (
                <View key={i} style={styles.taskItem}>
                  <Feather name={t.icon} size={20} color="#3e7c52" />
                  <Text style={styles.taskName}>
                    {t.type} — {t.name}
                  </Text>
                  <Text style={styles.taskTime}>In {t.text}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9faf9" },
  background: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 70 },

  heroCard: {
    marginTop: 30,
    borderRadius: 25,
    overflow: "hidden",
    shadowColor: "#3e7c52",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  headerGradient: { padding: 25 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },

  bellBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(95,156,108,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 7,
    right: 7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "white", fontWeight: "900", fontSize: 11 },

  date: { fontSize: 14, color: "#666", marginBottom: 4 },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2e4d35",
  },
  username: { color: "#4b9560" },

  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 2,
    borderColor: "#5f9c6c",
  },

  summaryCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#ffffffdd",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  summaryText: {
    fontSize: 16,
    color: "#3e7c52",
    fontWeight: "600",
    marginBottom: 6,
  },

  sectionTitle: {
    marginTop: 25,
    fontSize: 22,
    fontWeight: "800",
    color: "#3e7c52",
    marginBottom: 10,
  },

  taskHighlight: {
    marginTop: 20,
  },

  taskCard: {
    flexDirection: "row",
    backgroundColor: "#ffffffdd",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },

  taskName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e4d35",
  },

  taskTime: {
    fontSize: 14,
    color: "#4b9560",
    marginTop: 3,
  },

  taskOverdue: {
    fontSize: 14,
    color: "#b91c1c",
    marginLeft: "auto",
    fontWeight: "700",
  },

  taskItem: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#ffffffdd",
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  taskItemOverdue: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#ffefef",
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
