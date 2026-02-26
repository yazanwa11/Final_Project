import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    FlatList,
    Image,
    ActivityIndicator,
    StyleSheet,
    Animated,
    Modal,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

type SuggestedPlant = {
    id?: number;
    name: string;
    category: string;
    watering_interval: number;
    sunlight_interval: number;
    image?: string;
};

const MY_PLANTS_ROUTE = "/(tabs)/MyPlantsScreen";

export default function SuggestedPlantsScreen() {
    const [plants, setPlants] = useState<SuggestedPlant[]>([]);
    const [loading, setLoading] = useState(true);

    const [selected, setSelected] = useState<SuggestedPlant | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [adding, setAdding] = useState(false);

    // Duplicate modal
    const [dupVisible, setDupVisible] = useState(false);
    const dupScale = useRef(new Animated.Value(0.85)).current;

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const showDuplicateModal = () => {
        setDupVisible(true);
        dupScale.setValue(0.85);
        Animated.spring(dupScale, {
            toValue: 1,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
        }).start();
    };

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

    const fetchSuggestions = async () => {
        try {
            const response = await fetchWithAuth("http://10.0.2.2:8000/api/plants/suggestions/", {
                headers: { Accept: "application/json" },
            });

            const raw = await response.text();
            console.log("Suggestions status:", response.status);
            console.log("Suggestions raw:", raw);

            if (!response.ok) {
                throw new Error(`Suggestions API failed: ${response.status} ${raw}`);
            }

            const data = JSON.parse(raw);
            if (!Array.isArray(data)) {
                throw new Error(`Expected array, got: ${JSON.stringify(data)}`);
            }

            setPlants(data);
        } catch (err) {
            console.error("Failed to fetch suggestions", err);
            setPlants([]);
        } finally {
            setLoading(false);
        }
    };

    const addSuggestedPlant = async (plant: SuggestedPlant) => {
        try {
            setAdding(true);

            const res = await fetchWithAuth("http://10.0.2.2:8000/api/plants/add-suggested/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plant),
            });

            const raw = await res.text();

            if (res.status === 409) {
                setConfirmOpen(false);
                setSelected(null);
                showDuplicateModal();
                return;
            }

            if (!res.ok) throw new Error(`Add suggested failed: ${res.status} ${raw}`);

            setConfirmOpen(false);
            setSelected(null);

            router.replace(MY_PLANTS_ROUTE);
        } catch (err) {
            console.error("Failed to add suggested plant", err);
        } finally {
            setAdding(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2d6a4f" />
            </View>
        );
    }

    return (
        <LinearGradient colors={["#d8f3dc", "#f6fff8"]} style={{ flex: 1 }}>
            <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
                <View style={styles.container}>
                    <Text style={styles.title}>Suggested Plants</Text>
                    <Text style={styles.subtitle}>Pick one and we’ll set the schedule for you</Text>

                    <FlatList
                        data={plants}
                        keyExtractor={(item, index) => (item.id ? String(item.id) : item.name + index)}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Feather name="search" size={22} color="#2d6a4f" />
                                <Text style={styles.emptyTitle}>No suggestions yet</Text>
                                <Text style={styles.emptyText}>Try again later or change the search query.</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <Pressable
                                style={styles.card}
                                onPress={() => {
                                    setSelected(item);
                                    setConfirmOpen(true);
                                }}
                            >
                                {item.image ? (
                                    <Image source={{ uri: item.image }} style={styles.image} />
                                ) : (
                                    <View style={styles.imagePlaceholder}>
                                        <Feather name="image" size={20} color="#2d6a4f" />
                                    </View>
                                )}

                                <View style={styles.info}>
                                    <Text style={styles.name} numberOfLines={1}>
                                        {item.name}
                                    </Text>

                                    <View style={styles.pillsRow}>
                                        <View style={styles.pill}>
                                            <Text style={styles.pillText}>💧 {item.watering_interval}d</Text>
                                        </View>
                                        <View style={styles.pill}>
                                            <Text style={styles.pillText}>☀️ {item.sunlight_interval}d</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.hint} numberOfLines={1}>
                                        Tap to add to My Plants
                                    </Text>
                                </View>

                                <View style={styles.chev}>
                                    <Feather name="chevron-right" size={20} color="#2d6a4f" />
                                </View>
                            </Pressable>
                        )}
                    />
                </View>

                {/* Confirmation Modal */}
                <Modal transparent visible={confirmOpen} animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>Add this plant?</Text>

                            <View style={styles.modalRow}>
                                {selected?.image ? (
                                    <Image source={{ uri: selected.image }} style={styles.modalImage} />
                                ) : (
                                    <View style={styles.modalImageFallback}>
                                        <Feather name="image" size={18} color="#2d6a4f" />
                                    </View>
                                )}

                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalName} numberOfLines={2}>
                                        {selected?.name}
                                    </Text>
                                    <Text style={styles.modalMeta}>💧 Every {selected?.watering_interval} days</Text>
                                    <Text style={styles.modalMeta}>☀️ Every {selected?.sunlight_interval} days</Text>
                                </View>
                            </View>

                            <View style={styles.modalActions}>
                                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setConfirmOpen(false)} disabled={adding}>
                                    <Text style={styles.btnGhostText}>Cancel</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.btn, styles.btnPrimary, adding && { opacity: 0.85 }]}
                                    onPress={() => selected && addSuggestedPlant(selected)}
                                    disabled={adding}
                                >
                                    <Text style={styles.btnPrimaryText}>{adding ? "Adding..." : "Add Plant"}</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Duplicate Modal (beautiful) */}
                <Modal transparent visible={dupVisible} animationType="fade" onRequestClose={() => setDupVisible(false)}>
                    <View style={styles.modalBackdrop}>
                        <Animated.View style={[styles.dupCard, { transform: [{ scale: dupScale }] }]}>
                            <View style={styles.dupIconCircle}>
                                <Feather name="alert-triangle" size={26} color="#2d6a4f" />
                            </View>

                            <Text style={styles.dupTitle}>Already added 🌿</Text>
                            <Text style={styles.dupText}>This plant is already in your My Plants list.</Text>

                            <View style={styles.dupActions}>
                                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setDupVisible(false)}>
                                    <Text style={styles.btnGhostText}>Close</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.btn, styles.btnPrimary]}
                                    onPress={() => {
                                        setDupVisible(false);
                                        router.replace(MY_PLANTS_ROUTE);
                                    }}
                                >
                                    <Text style={styles.btnPrimaryText}>Go to My Plants</Text>
                                </Pressable>
                            </View>
                        </Animated.View>
                    </View>
                </Modal>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    title: { fontSize: 26, fontWeight: "900", color: "#1b4332" },
    subtitle: { marginTop: 6, fontSize: 14, color: "#3a6b52", marginBottom: 14 },

    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 18,
        marginBottom: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.12)",
    },

    image: { width: 92, height: 92 },
    imagePlaceholder: {
        width: 92,
        height: 92,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(216,243,220,0.7)",
    },

    info: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
    name: { fontSize: 16, fontWeight: "900", color: "#163a2b" },

    pillsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    pill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(82,183,136,0.14)",
        borderWidth: 1,
        borderColor: "rgba(82,183,136,0.25)",
    },
    pillText: { fontSize: 12.5, fontWeight: "800", color: "#1b4332" },

    hint: { marginTop: 8, fontSize: 12.5, color: "#4a7856" },
    chev: { paddingRight: 12 },

    empty: {
        marginTop: 30,
        alignItems: "center",
        padding: 16,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.75)",
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.12)",
    },
    emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#1b4332" },
    emptyText: { marginTop: 6, fontSize: 13, color: "#3a6b52", textAlign: "center" },

    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        padding: 18,
    },
    modalCard: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.12)",
    },
    modalTitle: { fontSize: 18, fontWeight: "900", color: "#1b4332" },

    modalRow: { flexDirection: "row", gap: 12, marginTop: 14, alignItems: "center" },
    modalImage: { width: 64, height: 64, borderRadius: 14 },
    modalImageFallback: {
        width: 64,
        height: 64,
        borderRadius: 14,
        backgroundColor: "rgba(216,243,220,0.7)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalName: { fontSize: 15.5, fontWeight: "900", color: "#163a2b" },
    modalMeta: { marginTop: 4, fontSize: 13, color: "#3a6b52" },

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

    // Duplicate Modal
    dupCard: {
        backgroundColor: "white",
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.12)",
    },
    dupIconCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "rgba(216,243,220,0.8)",
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.14)",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
    },
    dupTitle: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: "900",
        color: "#1b4332",
        textAlign: "center",
    },
    dupText: {
        marginTop: 8,
        fontSize: 13.5,
        color: "#3a6b52",
        textAlign: "center",
        lineHeight: 19,
    },
    dupActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
    },
});
