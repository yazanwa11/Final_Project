import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ScrollView,
    Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");

type Plant = {
    id: string;
    name: string;
    category: string;
    location: string;
    image?: string | null;
    planting_date?: string | null;
};

// 🌿 Helper: Emoji by category
const getEmojiForCategory = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes("flower")) return "🌸";
    if (lower.includes("tree")) return "🌳";
    if (lower.includes("herb")) return "🌿";
    if (lower.includes("vegetable")) return "🥕";
    if (lower.includes("indoor")) return "🪴";
    return "🌱";
};

export default function MyPlantsScreen() {
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            const fetchPlants = async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem("access");
                    if (!token) {
                        Alert.alert("Error", "You must be logged in!");
                        return;
                    }

                    const res = await fetch("http://10.0.2.2:8000/api/plants/", {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setPlants(data);
                    } else {
                        console.log(await res.text());
                        Alert.alert("Error", "Failed to fetch plants.");
                    }
                } catch (err) {
                    console.error(err);
                    Alert.alert("Network Error", "Could not connect to the server.");
                } finally {
                    setLoading(false);
                }
            };

            fetchPlants();
        }, [])
    );

    const groupedPlants = plants.reduce((acc, plant) => {
        const area = plant.location?.trim() || "Unassigned";
        if (!acc[area]) acc[area] = [];
        acc[area].push(plant);
        return acc;
    }, {} as Record<string, Plant[]>);

    const groupedData = Object.entries(groupedPlants);

    return (
        <SafeAreaView style={styles.safeArea}>
            <LinearGradient
                colors={["#f9faf9", "#f3f7f4", "#eef5f0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.background}
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <LinearGradient
                        colors={["#b7e4c7", "#95d5b2", "#74c69d"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        <Text style={styles.title}>My Plants 🌿</Text>
                        <Text style={styles.subtitle}>
                            {plants.length
                                ? `You’re caring for ${plants.length} plant${plants.length > 1 ? "s" : ""
                                }`
                                : "Your green space is waiting!"}
                        </Text>
                    </LinearGradient>

                    {loading ? (
                        <ActivityIndicator size="large" color="#74c69d" style={{ marginTop: 60 }} />
                    ) : plants.length === 0 ? (
                        <Text style={styles.emptyText}>
                            You have no plants yet. Tap ➕ to start your garden!
                        </Text>
                    ) : (
                        groupedData.map(([area, areaPlants]) => (
                            <View key={area} style={styles.areaContainer}>
                                <View style={styles.areaHeader}>
                                    <Feather name="map-pin" size={18} color="#4a7856" />
                                    <Text style={styles.areaTitle}>
                                        {area === "Unassigned" ? "Other Plants" : area}
                                    </Text>
                                </View>

                                <View style={styles.plantGrid}>
                                    {areaPlants.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={styles.card}
                                            activeOpacity={0.85}
                                            onPress={() => router.push(`/PlantDetailsScreen?id=${item.id}`)}
                                        >
                                            <BlurView intensity={30} tint="light" style={styles.blurCard}>
                                                {item.image ? (
                                                    <Image
                                                        source={{
                                                            uri: item.image.startsWith("http")
                                                                ? item.image
                                                                : `http://10.0.2.2:8000${item.image}`,
                                                        }}
                                                        style={styles.image}
                                                    />
                                                ) : (
                                                    <View style={styles.placeholder}>
                                                        <Text style={styles.emoji}>
                                                            {getEmojiForCategory(item.category)}
                                                        </Text>
                                                    </View>
                                                )}

                                                <Text style={styles.name}>{item.name}</Text>

                                                <View style={styles.metaRow}>
                                                    <Feather name="layers" size={13} color="#4a7856" />
                                                    <Text style={styles.metaText}>{item.category}</Text>
                                                </View>

                                                {item.planting_date && (
                                                    <View style={styles.metaRow}>
                                                        <Feather name="calendar" size={13} color="#4a7856" />
                                                        <Text style={styles.metaText}>{item.planting_date}</Text>
                                                    </View>
                                                )}
                                            </BlurView>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                            </View>
                        ))
                    )}
                </ScrollView>

                {/* Add Button */}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push("/(tabs)/AddPlantScreen" as any)}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={["#74c69d", "#52b788"]}
                        style={styles.addGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Feather name="plus" size={30} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </LinearGradient>
        </SafeAreaView>
    );
}

const CARD_WIDTH = width * 0.42;

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    background: { flex: 1 },
    header: {
        borderBottomLeftRadius: 45,
        borderBottomRightRadius: 45,
        paddingVertical: 55,
        alignItems: "center",
        shadowColor: "#74c69d",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 25,
    },
    title: {
        color: "#1b4332",
        fontWeight: "800",
        fontSize: 28,
        letterSpacing: 0.3,
    },
    subtitle: {
        color: "#2d6a4f",
        marginTop: 6,
        fontSize: 15,
        fontStyle: "italic",
    },
    emptyText: {
        textAlign: "center",
        color: "#4a7856",
        fontSize: 15,
        marginTop: 100,
    },
    areaContainer: {
        marginBottom: 35,
        paddingHorizontal: 18,
    },
    areaHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 14,
    },
    areaTitle: {
        fontSize: 19,
        fontWeight: "700",
        color: "#2d6a4f",
        marginLeft: 8,
    },
    plantGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: {
        width: CARD_WIDTH,
        marginBottom: 16,
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 5,
    },
    blurCard: {
        padding: 14,
        borderRadius: 20,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.65)",
    },
    image: {
        width: "100%",
        height: CARD_WIDTH,
        borderRadius: 16,
        marginBottom: 10,
    },
    placeholder: {
        width: "100%",
        height: CARD_WIDTH,
        borderRadius: 16,
        backgroundColor: "#e9f5ee",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },
    emoji: {
        fontSize: 52,
    },
    name: {
        fontSize: 17,
        fontWeight: "700",
        color: "#1b4332",
        textAlign: "center",
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 2,
    },
    metaText: { color: "#2d6a4f", fontSize: 13, marginLeft: 5 },
    addButton: {
        position: "absolute",
        bottom: 28,
        right: 25,
        borderRadius: 40,
        shadowColor: "#52b788",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    addGradient: {
        width: 70,
        height: 70,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
    },
});
