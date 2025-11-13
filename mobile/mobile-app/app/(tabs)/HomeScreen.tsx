import React from "react";
import {  useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Image,
  Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native"; // ⭐ IMPORTANT

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{
    username: string;
    email: string;
    avatar?: string | null; // ⭐ ADD avatar field
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [greeting, setGreeting] = useState("");

  // ⭐ Fetch user each time screen becomes active
  useFocusEffect(
    React.useCallback(() => {
      const fetchUser = async () => {
        try {
          const token = await AsyncStorage.getItem("access");
          if (!token) return;

          const res = await fetch("http://10.0.2.2:8000/api/users/me/", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const data = await res.json();
            console.log("USER FROM API:", data); // ⭐ DEBUG LOG
            setUser(data);
          }
        } catch (err) {
          console.error(err);
        }
      };

      fetchUser();
    }, [])
  );

  // Greeting + animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#f9faf9", "#e8f0eb", "#dae7df"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.background}
      >
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <ScrollView contentContainerStyle={styles.scroll}>
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
                    {greeting},{" "}
                    <Text style={styles.username}>{user?.username || "Buddy"} 🌿</Text>
                  </Text>
                </View>

                <TouchableOpacity onPress={() => router.push("(tabs)/ProfileScreen" as any)}>
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
            </LinearGradient>
          </Animated.View>

          {/* Quick Actions */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.addButton]}
                onPress={() => router.push("/(tabs)/AddPlantScreen" as any)}
              >
                <Feather name="plus-circle" size={20} color="#fff" />
                <Text style={styles.actionText}>Add Plant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.myPlantsButton]}
                onPress={() => router.push("/(tabs)/MyPlantsScreen" as any)}
              >
                <Ionicons name="leaf-outline" size={20} color="#fff" />
                <Text style={styles.actionText}>My Plants</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Dashboard Cards */}
          <View style={styles.cardGrid}>
            {[
              { emoji: "🌿", title: "My Plants", value: "8" },
              { emoji: "💧", title: "Upcoming Tasks", value: "3" },
              { emoji: "🌞", title: "Growth Progress", value: "75%" },
              { emoji: "🪴", title: "Recent Logs", value: "5 logs" },
            ].map((item, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.card,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <Text style={styles.cardEmoji}>{item.emoji}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardValue}>{item.value}</Text>
              </Animated.View>
            ))}
          </View>

          <Text style={styles.footer}>GreenBuddy 🌱 — Where Nature Meets Tech</Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9faf9" },
  background: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  heroCard: {
    marginTop: 30,
    borderRadius: 25,
    overflow: "hidden",
    shadowColor: "#3e7c52",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  headerGradient: { padding: 25 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: { fontSize: 14, color: "#666", marginBottom: 4 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#2e4d35" },
  username: { color: "#4b9560" },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 2,
    borderColor: "#5f9c6c",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  addButton: { backgroundColor: "#3e7c52" },
  myPlantsButton: { backgroundColor: "#5f9c6c" },
  actionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
    marginLeft: 8,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "47%",
    backgroundColor: "#ffffffdd",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 15,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#3e7c52",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  cardEmoji: { fontSize: 30, marginBottom: 6 },
  cardTitle: { fontSize: 15, color: "#555" },
  cardValue: { fontSize: 20, fontWeight: "bold", color: "#3e7c52", marginTop: 4 },
  footer: {
    textAlign: "center",
    color: "#7c8d7d",
    marginTop: 10,
    fontSize: 13,
  },
});
