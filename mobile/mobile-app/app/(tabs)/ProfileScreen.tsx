import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  StatusBar,
  Animated,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

const DAY = 86400000;

type Plant = {
  id: number;
  last_watered?: string | null;
  last_sunlight?: string | null;
  watering_interval?: number;
  sunlight_interval?: number;
};

type UserData = {
  username: string;
  email: string;
  avatar?: string | null;
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();

  const [user, setUser] = useState<UserData | null>(null);
  const [plantsCount, setPlantsCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const isHebrew = currentLanguage === "he";

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const computeStats = (plants: Plant[]) => {
    const now = Date.now();
    let dueTasks = 0;
    let readinessScore = 0;

    plants.forEach((plant) => {
      if (plant.last_watered) {
        const nextWater =
          new Date(plant.last_watered).getTime() +
          (plant.watering_interval || 3) * DAY;
        if (nextWater <= now) dueTasks += 1;
        readinessScore += 0.5;
      }

      if (plant.last_sunlight) {
        const nextSun =
          new Date(plant.last_sunlight).getTime() +
          (plant.sunlight_interval || 1) * DAY;
        if (nextSun <= now) dueTasks += 1;
        readinessScore += 0.5;
      }
    });

    const progressPercent =
      plants.length > 0 ? Math.round((readinessScore / plants.length) * 100) : 0;

    setPlantsCount(plants.length);
    setTasksCount(dueTasks);
    setProgress(progressPercent);
  };

  const getAboutText = () => {
    if (plantsCount === 0) {
      return isHebrew
        ? "עדיין לא הוספת צמחים 🌱. אחרי שתוסיף צמח ראשון, תראה כאן תקציר אישי והתקדמות אמיתית."
        : "You haven’t added any plants yet 🌱. Once you add your first plant, this area will show a real personal summary.";
    }

    return isHebrew
      ? `יש לך כרגע ${plantsCount} צמחים במעקב, עם ${tasksCount} משימות פעילות. המשך טיפול קבוע ישפר את ההתקדמות שלך.`
      : `You currently track ${plantsCount} plants with ${tasksCount} active tasks. Consistent care will improve your progress.`;
  };

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          setLoadingStats(true);
          const token = await AsyncStorage.getItem("access");
          if (!token) {
            setLoadingStats(false);
            return;
          }

          const [userRes, plantsRes] = await Promise.all([
            fetch("http://10.0.2.2:8000/api/users/me/", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch("http://10.0.2.2:8000/api/plants/", {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData);
          }

          if (plantsRes.ok) {
            const plants = await plantsRes.json();
            computeStats(Array.isArray(plants) ? plants : []);
          } else {
            computeStats([]);
          }
        } catch (err) {
          console.error(err);
          computeStats([]);
        } finally {
          setLoadingStats(false);
        }
      };

      fetchData();

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }, [fadeAnim])
  );

  const handleLogout = async () => {
    Alert.alert(t("profile.logout"), t("profile.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.logout"),
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("access");
          await AsyncStorage.removeItem("refresh");
          router.replace("/");
        },
      },
    ]);
  };

  const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    setCurrentLanguage(lang);
  };

  return (
    <LinearGradient colors={["#f7fbf8", "#edf6ef", "#e0eee4"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7fbf8" />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t("profile.title")}</Text>
            {loadingStats ? <ActivityIndicator color="#2d6a4f" /> : null}
          </View>

          <View style={styles.profileCard}>
            <Image
              source={{
                uri:
                  user?.avatar && user.avatar !== "null"
                    ? user.avatar
                    : "https://cdn-icons-png.flaticon.com/512/219/219969.png",
              }}
              style={styles.avatar}
            />

            <Text style={styles.username}>{user?.username || "User"}</Text>
            <Text style={styles.email}>{user?.email || "example@mail.com"}</Text>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push("/EditProfileScreen")}
            >
              <Feather name="edit-2" size={15} color="#fff" />
              <Text style={styles.editText}>{t("profile.editProfile")}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{plantsCount}</Text>
              <Text style={styles.statLabel}>{t("profile.plants")}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>{tasksCount}</Text>
              <Text style={styles.statLabel}>{t("profile.tasks")}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>{progress}%</Text>
              <Text style={styles.statLabel}>{t("profile.progress")}</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.settingsBox}>
            <Text style={styles.sectionTitle}>{t("profile.language")}</Text>
            <View style={styles.languageContainer}>
              <TouchableOpacity
                style={[
                  styles.languageButton,
                  currentLanguage === "he" && styles.languageButtonActive,
                ]}
                onPress={() => changeLanguage("he")}
              >
                <Text
                  style={[
                    styles.languageText,
                    currentLanguage === "he" && styles.languageTextActive,
                  ]}
                >
                  🇮🇱 {t("profile.hebrew")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.languageButton,
                  currentLanguage === "en" && styles.languageButtonActive,
                ]}
                onPress={() => changeLanguage("en")}
              >
                <Text
                  style={[
                    styles.languageText,
                    currentLanguage === "en" && styles.languageTextActive,
                  ]}
                >
                  🇺🇸 {t("profile.english")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.aboutBox}>
            <Text style={styles.sectionTitle}>{t("profile.aboutMe")}</Text>
            <Text style={styles.aboutText}>{getAboutText()}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Feather name="log-out" size={16} color="#fff" />
            <Text style={styles.logoutText}>{t("profile.logout")}</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>{t("profile.footer")}</Text>
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 54,
    paddingBottom: 80,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#214734",
  },
  profileCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: "#dbeadf",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
    marginBottom: 16,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: "#60b68a",
  },
  username: {
    fontSize: 22,
    fontWeight: "800",
    color: "#204735",
  },
  email: {
    fontSize: 15,
    color: "#6c8578",
    marginBottom: 14,
  },
  editButton: {
    backgroundColor: "#2d6a4f",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editText: {
    color: "#fff",
    fontWeight: "700",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    width: "30%",
    alignItems: "center",
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#dbeadf",
  },
  statValue: {
    fontSize: 21,
    fontWeight: "800",
    color: "#2d6a4f",
  },
  statLabel: {
    color: "#607b6c",
    marginTop: 5,
    fontWeight: "600",
    fontSize: 12,
  },
  progressTrack: {
    height: 9,
    width: "100%",
    backgroundColor: "#dbeadf",
    borderRadius: 99,
    marginBottom: 18,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2d6a4f",
    borderRadius: 99,
  },
  settingsBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#dbeadf",
    marginBottom: 14,
  },
  languageContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  languageButton: {
    flex: 1,
    backgroundColor: "#f3f8f5",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  languageButtonActive: {
    backgroundColor: "#e5f3ea",
    borderColor: "#2d6a4f",
  },
  languageText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#657e71",
  },
  languageTextActive: {
    color: "#2d6a4f",
    fontWeight: "700",
  },
  aboutBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#dbeadf",
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#214734",
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 15,
    color: "#5f7769",
    lineHeight: 22,
  },
  logoutButton: {
    backgroundColor: "#d34d44",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 15,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    color: "#87998f",
    fontSize: 12,
    marginTop: 6,
  },
});
