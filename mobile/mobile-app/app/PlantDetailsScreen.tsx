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
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

// -----------------------------------------------------
// COUNTDOWN (unchanged)
// -----------------------------------------------------
function countdown(lastAction: string | null, intervalDays: number) {
    if (!lastAction || !intervalDays) return "Not set";

    const last = new Date(lastAction).getTime();
    const now = Date.now();

    const next = last + intervalDays * 86400000; // next due time
    const diff = next - now;

    // ⛔ OVERDUE
    if (diff < 0) {
        const overdueMins = Math.floor(Math.abs(diff) / 60000);
        const hours = Math.floor(overdueMins / 60);
        const mins = overdueMins % 60;

        if (hours > 0) return `Overdue ${hours}h ${mins}m`;
        return `Overdue ${mins}m`;
    }

    // ⏱️ NORMAL COUNTDOWN
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}


// ICON COLORS UPDATED TO NATURAL GREEN THEME
function getIcon(action: string) {
    action = action.toLowerCase();

    if (action.includes("water"))
        return <Feather name="droplet" size={20} color="#3e7c52" />;
    if (action.includes("sun"))
        return <Feather name="sun" size={20} color="#f4c430" />;

    return <Feather name="activity" size={20} color="#5f9c6c" />;
}

export default function PlantDetailsScreen() {
    const { id } = useLocalSearchParams();
    const [plant, setPlant] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [open, setOpen] = useState(false);
    const [type, setType] = useState<"watering" | "sunlight">("watering");
    const [interval, setInterval] = useState("3");

    const scale = useRef(new Animated.Value(0)).current;

    const animateModal = () => {
        scale.setValue(0);
        Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
        }).start();
    };

    // LOAD DATA
    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            const token = await AsyncStorage.getItem("access");

            const p = await fetch(`http://10.0.2.2:8000/api/plants/${id}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const plantData = await p.json();
            setPlant(plantData);

            const lg = await fetch(`http://10.0.2.2:8000/api/plants/${id}/logs/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const logData = await lg.json();
            setLogs(Array.isArray(logData) ? logData : []);

            setLoading(false);
        } catch (e) {
            console.log("LOAD ERROR:", e);
            setLoading(false);
        }
    };

    const doAction = async (action: "Watered" | "Sunlight") => {
        try {
            const token = await AsyncStorage.getItem("access");

            const res = await fetch(`http://10.0.2.2:8000/api/plants/${id}/logs/add/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ action, notes: "" }),
            });

            if (res.ok) {
                const now = new Date().toISOString();
                setPlant((prev: any) => ({
                    ...prev,
                    last_watered: action === "Watered" ? now : prev.last_watered,
                    last_sunlight: action === "Sunlight" ? now : prev.last_sunlight,
                }));
            }

            loadAll();
        } catch (e) {
            console.log("ACTION FAIL:", e);
        }
    };

    const saveInterval = async () => {
        const token = await AsyncStorage.getItem("access");

        const body =
            type === "watering"
                ? { watering_interval: interval }
                : { sunlight_interval: interval };

        const res = await fetch(`http://10.0.2.2:8000/api/plants/${id}/reminders/`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            let upd = await res.json();
            setPlant((prev: any) => ({
                ...prev,
                watering_interval: upd.watering_interval,
                sunlight_interval: upd.sunlight_interval,
            }));
        }

        setOpen(false);
    };

    if (loading || !plant) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#5f9c6c" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safe}>

            {/* NEW MINT BACKGROUND */}
            <LinearGradient
                colors={["#f9faf9", "#e8f0eb", "#dae7df"]}
                style={styles.bg}
            />

            <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>

                {/* HEADER */}
                <View style={styles.header}>
                    <Image source={{ uri: plant.image }} style={styles.image} />
                    <Text style={styles.name}>{plant.name}</Text>
                    <Text style={styles.category}>{plant.category}</Text>
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.waterBtn]}
                        onPress={() => doAction("Watered")}
                    >
                        <Feather name="droplet" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Water</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.sunBtn]}
                        onPress={() => doAction("Sunlight")}
                    >
                        <Feather name="sun" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Sunlight</Text>
                    </TouchableOpacity>
                </View>

                {/* CARE SCHEDULE */}
                <Text style={styles.section}>Care Schedule</Text>

                {/* WATERING CARD */}
                <View style={styles.card}>
                    <View style={styles.cardTop}>
                        <Feather name="droplet" size={22} color="#3e7c52" />
                        <Text style={styles.cardTitle}>Watering</Text>
                    </View>

                    <Text style={styles.value}>
                        Every <Text style={styles.bold}>{plant.watering_interval}</Text> days
                    </Text>

                    <Text style={styles.subValue}>
                        {countdown(plant.last_watered, plant.watering_interval)}
                    </Text>

                    <TouchableOpacity
                        onPress={() => {
                            setType("watering");
                            setInterval(String(plant.watering_interval));
                            setOpen(true);
                            animateModal();
                        }}
                    >
                        <Text style={styles.edit}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {/* SUNLIGHT CARD */}
                <View style={styles.card}>
                    <View style={styles.cardTop}>
                        <Feather name="sun" size={22} color="#f4c430" />
                        <Text style={styles.cardTitle}>Sunlight</Text>
                    </View>

                    <Text style={styles.value}>
                        Every <Text style={styles.bold}>{plant.sunlight_interval}</Text> days
                    </Text>

                    <Text style={styles.subValue}>
                        {countdown(plant.last_sunlight, plant.sunlight_interval)}
                    </Text>

                    <TouchableOpacity
                        onPress={() => {
                            setType("sunlight");
                            setInterval(String(plant.sunlight_interval));
                            setOpen(true);
                            animateModal();
                        }}
                    >
                        <Text style={styles.edit}>Edit</Text>
                    </TouchableOpacity>
                </View>

                {/* HISTORY */}
                <Text style={styles.section}>Care History</Text>

                {logs.length === 0 ? (
                    <Text style={styles.empty}>No activity yet</Text>
                ) : (
                    logs.map((log) => (
                        <View key={log.id} style={styles.log}>
                            <View style={styles.iconWrap}>{getIcon(log.action)}</View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.logAction}>{log.action}</Text>
                                <Text style={styles.logDate}>
                                    {new Date(log.date).toLocaleString()}
                                </Text>
                            </View>
                        </View>
                    ))
                )}

                {/* MODAL */}
                <Modal transparent visible={open} animationType="fade">
                    <View style={styles.overlay}>
                        <Animated.View style={[styles.modal, { transform: [{ scale }] }]}>

                            <Text style={styles.modalTitle}>
                                Edit {type === "watering" ? "Watering" : "Sunlight"} Interval
                            </Text>

                            <TextInput
                                style={styles.input}
                                value={interval}
                                keyboardType="numeric"
                                onChangeText={setInterval}
                            />

                            <TouchableOpacity style={styles.saveBtn} onPress={saveInterval}>
                                <Text style={styles.saveTxt}>Save</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Text style={styles.cancelTxt}>Cancel</Text>
                            </TouchableOpacity>

                        </Animated.View>
                    </View>
                </Modal>

            </ScrollView>
        </SafeAreaView>
    );
}

//
// -----------------------------------------------------
//  WHITE + MINT THEME STYLES ✔
// -----------------------------------------------------
//
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#f9faf9" },

    bg: { ...StyleSheet.absoluteFillObject },

    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: {
        alignItems: "center",
        paddingVertical: 35,
    },

    image: {
        width: 150,
        height: 150,
        borderRadius: 20,
        marginBottom: 10,
    },

    name: {
        fontSize: 32,
        fontWeight: "900",
        color: "#3e7c52",
    },

    category: {
        fontSize: 15,
        color: "#6b7f6d",
        marginTop: 3,
    },

    // ACTION BUTTONS
    actionRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginHorizontal: 20,
        marginBottom: 10,
    },

    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },

    waterBtn: { backgroundColor: "#3e7c52" },
    sunBtn: { backgroundColor: "#5f9c6c" },

    actionBtnText: {
        color: "#fff",
        fontWeight: "800",
        marginLeft: 8,
        fontSize: 15,
    },

    // CARD SECTION
    section: {
        marginLeft: 22,
        marginTop: 26,
        fontSize: 21,
        fontWeight: "800",
        color: "#3e7c52",
    },

    card: {
        backgroundColor: "#ffffffdd",
        marginHorizontal: 20,
        marginTop: 14,
        padding: 22,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 4,
    },

    cardTop: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
        gap: 10,
    },

    cardTitle: {
        fontSize: 19,
        fontWeight: "800",
        color: "#3e7c52",
    },

    value: {
        fontSize: 15,
        color: "#4c5c51",
        marginTop: 3,
    },

    bold: { fontWeight: "900", color: "#3e7c52" },

    subValue: {
        marginTop: 5,
        fontSize: 13,
        color: "#5f9c6c",
        fontWeight: "600",
    },

    edit: {
        marginTop: 12,
        color: "#3e7c52",
        fontWeight: "900",
    },

    empty: {
        textAlign: "center",
        marginTop: 20,
        color: "#7c8d7d",
        fontSize: 15,
    },

    log: {
        flexDirection: "row",
        backgroundColor: "#ffffffdd",
        marginHorizontal: 20,
        padding: 15,
        borderRadius: 18,
        marginTop: 10,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 3,
    },

    iconWrap: {
        width: 30,
        alignItems: "center",
        marginRight: 10,
    },

    logAction: {
        fontSize: 16,
        fontWeight: "800",
        color: "#3e7c52",
    },

    logDate: {
        marginTop: 4,
        fontSize: 12,
        color: "#6b7f6d",
    },

    // MODAL
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },

    modal: {
        width: "82%",
        backgroundColor: "#e8f0eb",
        padding: 25,
        borderRadius: 20,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },

    modalTitle: {
        fontSize: 20,
        fontWeight: "900",
        marginBottom: 15,
        color: "#3e7c52",
    },

    input: {
        width: "100%",
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: "#cbd5c0",
        color: "#333",
    },

    saveBtn: {
        backgroundColor: "#3e7c52",
        paddingVertical: 12,
        paddingHorizontal: 50,
        borderRadius: 12,
    },

    saveTxt: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 16,
    },

    cancelTxt: {
        marginTop: 12,
        color: "#7c8d7d",
        fontSize: 14,
    },
});
