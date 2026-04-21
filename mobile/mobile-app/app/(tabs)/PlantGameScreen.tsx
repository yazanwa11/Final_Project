import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type ItemType = "water" | "sun" | "fertilizer" | "bug";

type ActiveItem = {
  cell: number | null;
  type: ItemType | null;
  tapped: boolean;
};

const GAME_SECONDS = 45;
const GRID_SIZE = 9;

const GOOD_ITEMS: ItemType[] = ["water", "sun", "fertilizer"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function randomItemType(): ItemType {
  const roll = Math.random();
  if (roll < 0.75) {
    return GOOD_ITEMS[Math.floor(Math.random() * GOOD_ITEMS.length)];
  }
  return "bug";
}

function itemEmoji(type: ItemType | null) {
  if (!type) return "";
  if (type === "water") return "💧";
  if (type === "sun") return "☀️";
  if (type === "fertilizer") return "🌱";
  return "🐛";
}

export default function PlantGameScreen() {
  const router = useRouter();

  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [running, setRunning] = useState(true);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [bloom, setBloom] = useState(50);

  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [activeType, setActiveType] = useState<ItemType | null>(null);

  const activeRef = useRef<ActiveItem>({ cell: null, type: null, tapped: false });

  const spawnMs = useMemo(() => {
    if (timeLeft > 30) return 900;
    if (timeLeft > 15) return 700;
    return 520;
  }, [timeLeft]);

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running) return;

    const spawner = setInterval(() => {
      const previous = activeRef.current;

      if (previous.type && !previous.tapped) {
        if (previous.type === "bug") {
          setBloom((prev) => clamp(prev + 1, 0, 100));
        } else {
          setCombo(0);
          setBloom((prev) => clamp(prev - 6, 0, 100));
          setScore((prev) => Math.max(0, prev - 2));
        }
      }

      const nextCell = Math.floor(Math.random() * GRID_SIZE);
      const nextType = randomItemType();

      activeRef.current = { cell: nextCell, type: nextType, tapped: false };
      setActiveCell(nextCell);
      setActiveType(nextType);
    }, spawnMs);

    return () => clearInterval(spawner);
  }, [running, spawnMs]);

  useEffect(() => {
    if (bloom <= 0) {
      setRunning(false);
      setBloom(0);
    }
  }, [bloom]);

  const handleCellPress = (index: number) => {
    if (!running) return;

    const current = activeRef.current;
    if (current.cell !== index || !current.type || current.tapped) return;

    current.tapped = true;

    if (current.type === "bug") {
      setCombo(0);
      setScore((prev) => Math.max(0, prev - 8));
      setBloom((prev) => clamp(prev - 10, 0, 100));
    } else {
      setCombo((prev) => {
        const next = prev + 1;
        setBestCombo((best) => Math.max(best, next));
        return next;
      });
      setScore((prev) => prev + 10);
      setBloom((prev) => clamp(prev + 7, 0, 100));
    }

    setActiveCell(null);
    setActiveType(null);
  };

  const closeGame = () => {
    router.replace("/(tabs)/HomeScreen");
  };

  const restart = () => {
    activeRef.current = { cell: null, type: null, tapped: false };
    setTimeLeft(GAME_SECONDS);
    setRunning(true);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setBloom(50);
    setActiveCell(null);
    setActiveType(null);
  };

  const resultText =
    score >= 320
      ? "Master Gardener. Your balcony is now a jungle."
      : score >= 200
        ? "Great run. Your plant had a very good day."
        : "It survived. Barely. Still funny though.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#f6fbf2", "#dff0d5", "#cce6bc"]} style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Grow Rush</Text>
          <TouchableOpacity onPress={closeGame} style={styles.closeBtn}>
            <Feather name="x" size={20} color="#205033" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Tap good items. Avoid bugs. Keep bloom alive.</Text>

        <View style={styles.topStats}>
          <View style={styles.topCard}>
            <Text style={styles.topLabel}>Time</Text>
            <Text style={styles.topValue}>{timeLeft}s</Text>
          </View>
          <View style={styles.topCard}>
            <Text style={styles.topLabel}>Score</Text>
            <Text style={styles.topValue}>{score}</Text>
          </View>
          <View style={styles.topCard}>
            <Text style={styles.topLabel}>Combo</Text>
            <Text style={styles.topValue}>x{combo}</Text>
          </View>
        </View>

        <View style={styles.bloomWrap}>
          <View style={styles.bloomHeader}>
            <Text style={styles.bloomLabel}>Bloom Meter</Text>
            <Text style={styles.bloomValue}>{bloom}%</Text>
          </View>
          <View style={styles.bloomTrack}>
            <View style={[styles.bloomFill, { width: `${bloom}%` }]} />
          </View>
        </View>

        <View style={styles.grid}>
          {Array.from({ length: GRID_SIZE }).map((_, index) => {
            const isActive = activeCell === index && activeType !== null;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.cell, isActive && styles.activeCell]}
                activeOpacity={0.85}
                onPress={() => handleCellPress(index)}
              >
                <Text style={styles.cellEmoji}>{isActive ? itemEmoji(activeType) : ""}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          <Text style={styles.legendText}>💧 ☀️ 🌱 = + points</Text>
          <Text style={styles.legendText}>🐛 = trap</Text>
        </View>

        {!running && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Round Over</Text>
            <Text style={styles.resultText}>{resultText}</Text>
            <Text style={styles.resultMeta}>Best combo: x{bestCombo}</Text>

            <View style={styles.resultButtons}>
              <TouchableOpacity onPress={restart} style={styles.retryBtn}>
                <Text style={styles.retryText}>Play Again</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeGame} style={styles.homeBtn}>
                <Text style={styles.homeText}>Back Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f6fbf2" },
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 20 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#205033",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(32,80,51,0.25)",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    color: "#3f6f50",
    fontWeight: "600",
  },

  topStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  topCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffffd8",
    alignItems: "center",
  },
  topLabel: {
    fontSize: 12,
    color: "#4f7f5c",
    fontWeight: "700",
  },
  topValue: {
    marginTop: 3,
    fontSize: 20,
    color: "#1e4d31",
    fontWeight: "900",
  },

  bloomWrap: {
    backgroundColor: "#ffffffd8",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  bloomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  bloomLabel: {
    color: "#2f5f3f",
    fontWeight: "700",
  },
  bloomValue: {
    color: "#2f5f3f",
    fontWeight: "900",
  },
  bloomTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e3eee1",
    overflow: "hidden",
  },
  bloomFill: {
    height: "100%",
    backgroundColor: "#38a169",
    borderRadius: 999,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cell: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffffcc",
    borderWidth: 1,
    borderColor: "rgba(33,84,53,0.12)",
  },
  activeCell: {
    backgroundColor: "#f8fff2",
    borderColor: "#70b07a",
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  cellEmoji: {
    fontSize: 34,
  },

  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  legendText: {
    color: "#37684a",
    fontWeight: "700",
    fontSize: 12,
  },

  resultCard: {
    backgroundColor: "#ffffffef",
    borderRadius: 14,
    padding: 14,
    marginTop: 2,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#205033",
  },
  resultText: {
    marginTop: 6,
    color: "#335f44",
    fontWeight: "600",
  },
  resultMeta: {
    marginTop: 8,
    color: "#2c5b3f",
    fontWeight: "700",
  },
  resultButtons: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  retryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#2f7f49",
  },
  retryText: {
    color: "#fff",
    fontWeight: "900",
  },
  homeBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#e2efe5",
  },
  homeText: {
    color: "#2f6042",
    fontWeight: "900",
  },
});
