import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Modal,
    TextInput,
    Animated,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// -------------------- Emoji helper ----------------------
const getEmojiForAction = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes("water")) return "💧";
    if (lower.includes("sun")) return "🌞";
    if (lower.includes("prune")) return "✂️";
    if (lower.includes("fert")) return "🧪";
    if (lower.includes("repot")) return "🪴";
    return "🌱";
};

// -------------------- Color helper ----------------------
const getColorForAction = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes("water")) return "#74c0fc"; // blue
    if (lower.includes("sun")) return "#f4a261";   // orange
    if (lower.includes("prune")) return "#a8dadc"; // teal
    if (lower.includes("fert")) return "#ffdd57";  // yellow
    if (lower.includes("repot")) return "#b7e4c7"; // mint
    return "#d8f3dc"; // default green
};

// -------------------- Time Ago Helper ----------------------
const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = (now.getTime() - date.getTime()) / 1000;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;

    return date.toLocaleDateString();
};

export default function PlantDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [plant, setPlant] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [modalVisible, setModalVisible] = useState(false);
    const [action, setAction] = useState("Watered");
    const [notes, setNotes] = useState("");

    const scaleAnim = useRef(new Animated.Value(0)).current;

    const animateModal = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
        }).start();
    };

    // Fetch plant + logs
    useEffect(() => {
        const fetchData = async () => {
            const token = await AsyncStorage.getItem("access");

            const plantRes = await fetch(`http://10.0.2.2:8000/api/plants/${id}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const plantData = await plantRes.json();
            setPlant(plantData);

            const logRes = await fetch(`http://10.0.2.2:8000/api/plants/${id}/logs/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const logData = await logRes.json();
            setLogs(logData.reverse()); // newest first

            setLoading(false);
        };

        fetchData();
    }, []);

    const saveLog = async () => {
        const token = await AsyncStorage.getItem("access");

        const res = await fetch(
            `http://10.0.2.2:8000/api/plants/${id}/logs/add/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action, notes }),
            }
        );

        if (res.ok) {
            setNotes("");
            setModalVisible(false);

            const refresh = await fetch(
                `http://10.0.2.2:8000/api/plants/${id}/logs/`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const updated = await refresh.json();
            setLogs(updated.reverse());
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView>
                {/* Header */}
                <LinearGradient
                    colors={["#cdeccd", "#f6fff8"]}
                    style={styles.header}
                >
                    <Image
                        source={{
                            uri: plant?.image
                                ? plant.image
                                : "https://cdn-icons-png.flaticon.com/512/3207/3207482.png",
                        }}
                        style={styles.plantImage}
                    />
                    <Text style={styles.plantName}>{plant?.name}</Text>
                    <Text style={styles.category}>{plant?.category}</Text>
                </LinearGradient>

                {/* Add Log */}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setModalVisible(true);
                        animateModal();
                    }}
                >
                    <Feather name="plus-circle" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add Care Log</Text>
                </TouchableOpacity>

                {/* Logs Title */}
                <Text style={styles.sectionTitle}>Care Logs</Text>

                {logs.length === 0 ? (
                    <Text style={styles.emptyText}>No logs yet 🌱</Text>
                ) : (
                    logs.map((log) => (
                        <View
                            key={log.id}
                            style={[
                                styles.logCard,
                                { borderLeftColor: getColorForAction(log.action) },
                            ]}
                        >
                            <Text style={styles.logAction}>
                                {getEmojiForAction(log.action)} {log.action}
                            </Text>

                            {log.notes ? (
                                <Text style={styles.logNotes}>{log.notes}</Text>
                            ) : null}

                            <Text style={styles.logDate}>{timeAgo(log.date)}</Text>
                        </View>
                    ))
                )}

                {/* Modal */}
                <Modal transparent visible={modalVisible} animationType="fade">
                    <View style={styles.modalOverlay}>
                        <Animated.View
                            style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}
                        >
                            <Text style={styles.modalTitle}>Add Care Log 🌱</Text>

                            <Text style={styles.label}>Action</Text>
                            <View style={styles.actionRow}>
                                {[
                                    "Watered",
                                    "Sunlight",
                                    "Pruned",
                                    "Fertilized",
                                    "Repotted",
                                    "Other",
                                ].map((item) => (
                                    <TouchableOpacity
                                        key={item}
                                        style={[
                                            styles.actionOption,
                                            action === item && styles.actionSelected,
                                        ]}
                                        onPress={() => setAction(item)}
                                    >
                                        <Text
                                            style={{
                                                color: action === item ? "#fff" : "#4a7856",
                                                fontWeight: "600",
                                            }}
                                        >
                                            {getEmojiForAction(item)} {item}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Notes */}
                            <Text style={styles.label}>Notes (optional)</Text>
                            <TextInput
                                style={styles.notesInput}
                                multiline
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Write something..."
                            />

                            <TouchableOpacity style={styles.saveButton} onPress={saveLog}>
                                <Text style={styles.saveButtonText}>Save Log</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
}

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#fdfdfd",
    },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    // HEADER
    header: {
        paddingVertical: 35,
        alignItems: "center",
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
    },
    plantImage: {
        width: 140,
        height: 140,
        borderRadius: 20,
        marginBottom: 12,
    },
    plantName: {
        fontSize: 26,
        fontWeight: "800",
        color: "#1b4332",
    },
    category: {
        fontSize: 15,
        color: "#4a7856",
        opacity: 0.8,
        marginTop: 5,
    },

    // Add Log Button
    addButton: {
        flexDirection: "row",
        alignSelf: "center",
        backgroundColor: "#4CAF50",
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 20,
        alignItems: "center",
        marginBottom: 20,
    },
    addButtonText: {
        color: "#fff",
        fontWeight: "700",
        marginLeft: 8,
    },

    // Logs
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#2e4d35",
        marginLeft: 20,
    },
    emptyText: {
        textAlign: "center",
        marginTop: 20,
        color: "#777",
        fontSize: 15,
    },
    logCard: {
        backgroundColor: "#ffffff",
        padding: 18,
        borderRadius: 16,
        marginHorizontal: 20,
        marginVertical: 10,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
        borderLeftWidth: 6,
    },
    logAction: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1b4332",
        marginBottom: 4,
    },
    logNotes: {
        fontSize: 14,
        color: "#444",
        marginTop: 2,
    },
    logDate: {
        fontSize: 13,
        color: "#6b705c",
        marginTop: 8,
        fontStyle: "italic",
    },

    // MODAL
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalCard: {
        width: "85%",
        backgroundColor: "#fff",
        padding: 25,
        borderRadius: 20,
        alignItems: "center",
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 20,
        color: "#2e4d35",
    },
    label: {
        alignSelf: "flex-start",
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 5,
        color: "#444",
    },
    actionRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 15,
    },
    actionOption: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#4a7856",
        margin: 5,
    },
    actionSelected: {
        backgroundColor: "#4a7856",
    },
    notesInput: {
        width: "100%",
        height: 80,
        backgroundColor: "#f2f2f2",
        borderRadius: 12,
        padding: 10,
        textAlignVertical: "top",
        marginBottom: 15,
    },
    saveButton: {
        backgroundColor: "#4CAF50",
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 12,
        marginBottom: 10,
    },
    saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    cancelText: { color: "#777", fontSize: 15, marginTop: 6 },
});
