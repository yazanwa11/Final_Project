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
    Modal,
    TextInput,
    Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    const [plants, setPlants] = useState<Plant[]>([]);
    const [loading, setLoading] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
    const [editName, setEditName] = useState("");
    const [editLocationChoice, setEditLocationChoice] = useState("Room");
    const [editLocationCustom, setEditLocationCustom] = useState("");
    const [editImageUri, setEditImageUri] = useState<string | null>(null);
    const [editImageChanged, setEditImageChanged] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const router = useRouter();

    const locationOptions = ["Room", "Outside", "Balcony", "Garden", "Custom"];

    useFocusEffect(
        useCallback(() => {
            const fetchPlants = async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem("access");
                    if (!token) {
                        Alert.alert(t('common.error'), t('auth.loginRequired'));
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
                        Alert.alert(t('common.error'), t('plants.fetchError'));
                    }
                } catch (err) {
                    console.error(err);
                    Alert.alert(t('common.error'), t('common.networkError'));
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

    const openEditPlant = (plant: Plant) => {
        const normalized = (plant.location || "").trim();
        const found = locationOptions.find(
            (option) => option.toLowerCase() === normalized.toLowerCase() && option !== "Custom"
        );

        setEditingPlant(plant);
        setEditName(plant.name || "");
        setEditLocationChoice(found || "Custom");
        setEditLocationCustom(found ? "" : normalized);
        setEditImageUri(plant.image || null);
        setEditImageChanged(false);
        setEditOpen(true);
    };

    const pickEditImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets?.length) {
            setEditImageUri(result.assets[0].uri);
            setEditImageChanged(true);
        }
    };

    const savePlantEdits = async () => {
        if (!editingPlant || editSaving) return;

        const finalName = editName.trim();
        if (!finalName) {
            Alert.alert(t('plants.missingName'), t('plants.enterPlantName'));
            return;
        }

        const finalLocation = editLocationChoice === "Custom" ? editLocationCustom.trim() : editLocationChoice;
        if (!finalLocation) {
            Alert.alert(t('plants.missingLocation'), t('plants.enterLocation'));
            return;
        }

        try {
            setEditSaving(true);
            const token = await AsyncStorage.getItem("access");
            if (!token) {
                Alert.alert("Error", "You must be logged in.");
                return;
            }

            const formData = new FormData();
            formData.append("name", finalName);
            formData.append("location", finalLocation);

            if (editImageChanged && editImageUri) {
                const filename = editImageUri.split("/").pop() || "plant.jpg";
                const ext = filename.split(".").pop()?.toLowerCase();
                const mime = ext === "png" ? "image/png" : "image/jpeg";

                formData.append("image_file", {
                    uri: editImageUri,
                    name: filename,
                    type: mime,
                } as any);
            }

            const res = await fetch(`http://10.0.2.2:8000/api/plants/${editingPlant.id}/`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
                body: formData,
            });

            const raw = await res.text();
            if (!res.ok) {
                throw new Error(raw || "Failed to update plant");
            }

            const updated = JSON.parse(raw);
            setPlants((prev) => prev.map((item) => (String(item.id) === String(updated.id) ? updated : item)));
            setEditOpen(false);
            setEditingPlant(null);
        } catch (error: any) {
            Alert.alert(t('plants.updateFailed'), error?.message || t('plants.updateError'));
        } finally {
            setEditSaving(false);
        }
    };

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
                        <Text style={styles.title}>{t('plants.myPlants')} 🌿</Text>
                        <Text style={styles.subtitle}>
                            {plants.length
                                ? `${t('plants.caringFor')} ${plants.length} ${plants.length > 1 ? t('plants.plants') : t('plants.plant')}`
                                : t('plants.greenSpaceWaiting')}
                        </Text>
                    </LinearGradient>

                    {loading ? (
                        <ActivityIndicator size="large" color="#74c69d" style={{ marginTop: 60 }} />
                    ) : plants.length === 0 ? (
                        <Text style={styles.emptyText}>
                            {t('plants.noPlantsYet')} ➕ {t('plants.startGarden')}
                        </Text>
                    ) : (
                        groupedData.map(([area, areaPlants]) => (
                            <View key={area} style={styles.areaContainer}>
                                <View style={styles.areaHeader}>
                                    <Feather name="map-pin" size={18} color="#4a7856" />
                                    <Text style={styles.areaTitle}>
                                        {area === "Unassigned" ? t('plants.otherPlants') : area}
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
                                            <Pressable style={styles.editPill} onPress={() => openEditPlant(item)}>
                                                <Feather name="edit-2" size={12} color="#fff" />
                                                <Text style={styles.editPillText}>{t('common.edit')}</Text>
                                            </Pressable>

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

                <Modal transparent visible={editOpen} animationType="fade" onRequestClose={() => setEditOpen(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{t('plants.editPlant')}</Text>
                                <Pressable onPress={() => setEditOpen(false)} style={styles.iconBtn}>
                                    <Feather name="x" size={18} color="#2e4d35" />
                                </Pressable>
                            </View>

                            <TextInput
                                style={styles.modalInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder={t('plants.plantName')}
                                placeholderTextColor="#7aa68a"
                            />

                            <Text style={styles.modalLabel}>{t('plants.location')}</Text>
                            <View style={styles.locationRow}>
                                {locationOptions.map((option) => (
                                    <Pressable
                                        key={option}
                                        style={[
                                            styles.locationChip,
                                            editLocationChoice === option && styles.locationChipActive,
                                        ]}
                                        onPress={() => setEditLocationChoice(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.locationChipText,
                                                editLocationChoice === option && styles.locationChipTextActive,
                                            ]}
                                        >
                                            {option}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {editLocationChoice === "Custom" ? (
                                <TextInput
                                    style={styles.modalInput}
                                    value={editLocationCustom}
                                    onChangeText={setEditLocationCustom}
                                    placeholder={t('plants.typeLocation')}
                                    placeholderTextColor="#7aa68a"
                                />
                            ) : null}

                            <TouchableOpacity onPress={pickEditImage} style={styles.imagePickerBtn}>
                                <Feather name="camera" size={16} color="#2e4d35" />
                                <Text style={styles.imagePickerText}>{t('plants.changePicture')}</Text>
                            </TouchableOpacity>

                            {editImageUri ? (
                                <Image
                                    source={{
                                        uri: editImageUri.startsWith("http")
                                            ? editImageUri
                                            : editImageUri.startsWith("/")
                                                ? `http://10.0.2.2:8000${editImageUri}`
                                                : editImageUri,
                                    }}
                                    style={styles.modalPreview}
                                />
                            ) : null}

                            <View style={styles.modalActions}>
                                <Pressable onPress={() => setEditOpen(false)} style={styles.secondaryBtn}>
                                    <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
                                </Pressable>

                                <Pressable onPress={savePlantEdits} style={styles.primaryBtnWide} disabled={editSaving}>
                                    {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('common.save')}</Text>}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Add Button */}
                {/* Floating Actions */}
                <View style={styles.fabWrap} pointerEvents="box-none">
                    <View style={styles.fabDock}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={styles.fabBtn}
                            onPress={() => router.push("/(tabs)/AddPlantScreen" as any)}
                        >
                            <LinearGradient
                                colors={["#2d6a4f", "#52b788"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.fabBtnGrad}
                            >
                                <Feather name="plus" size={18} color="#fff" />
                                <Text style={styles.fabBtnText}>{t('plants.addPlant')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={styles.fabBtn}
                            onPress={() => router.push("../suggested-plants" as any)}
                        >
                            <LinearGradient
                                colors={["#74c69d", "#b7e4c7"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.fabBtnGradAlt}
                            >
                                <Feather name="star" size={18} color="#1b4332" />

                                <Text style={styles.fabBtnTextAlt}>{t('plants.suggested')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

            </LinearGradient>
        </SafeAreaView>
    );
}

const CARD_WIDTH = width * 0.42;

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    background: { flex: 1 },
    header: {
        borderBottomLeftRadius: 35,
        borderBottomRightRadius: 35,
        paddingVertical: 65,
        alignItems: "center",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
        marginBottom: 30,
    },
    title: {
        color: "#1b4332",
        fontWeight: "900",
        fontSize: 32,
        letterSpacing: -0.5,
    },
    subtitle: {
        color: "#52b788",
        marginTop: 8,
        fontSize: 15,
        fontWeight: "600",
        opacity: 0.9,
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
        marginBottom: 16,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: "rgba(116,198,157,0.25)",
    },
    areaTitle: {
        fontSize: 21,
        fontWeight: "800",
        color: "#1b4332",
        marginLeft: 10,
        letterSpacing: -0.3,
    },
    plantGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    card: {
        width: CARD_WIDTH,
        marginBottom: 18,
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        transform: [{ scale: 1 }],
    },
    editPill: {
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 5,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "rgba(29,53,41,0.95)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 6,
    },
    editPillText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.3,
    },
    blurCard: {
        padding: 16,
        borderRadius: 24,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.80)",
        borderWidth: 1,
        borderColor: "rgba(212,241,223,0.5)",
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
        fontWeight: "800",
        color: "#1b4332",
        textAlign: "center",
        marginBottom: 6,
        letterSpacing: -0.2,
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
    fabWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 18,
        alignItems: "center",
    },
    fabDock: {
        flexDirection: "row",
        gap: 10,
        padding: 10,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.8)",
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.12)",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 10,
    },
    fabBtn: {
        borderRadius: 999,
        overflow: "hidden",
    },
    fabBtnGrad: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 999,
    },
    fabBtnGradAlt: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 999,
    },
    fabBtnText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 14,
    },
    fabBtnTextAlt: {
        color: "#1b4332",
        fontWeight: "900",
        fontSize: 14,
    },
    modalCard: {
        backgroundColor: "#ffffff",
        borderRadius: 28,
        padding: 24,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 15,
        backgroundColor: "rgba(255,255,255,0.98)",
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.14)",
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "800",
        color: "#1b4332",
        letterSpacing: -0.5,
    },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: "rgba(216,243,220,0.35)",
        alignItems: "center",
        justifyContent: "center",
    },
    modalInput: {
        marginTop: 12,
        backgroundColor: "#f8faf9",
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderWidth: 1.5,
        borderColor: "rgba(45,106,79,0.2)",
        color: "#1b4332",
        fontSize: 16,
        fontWeight: "600",
    },
    modalLabel: {
        marginTop: 12,
        color: "#4b9560",
        fontWeight: "800",
        fontSize: 12.5,
    },
    locationRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 8,
    },
    locationChip: {
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "rgba(82,183,136,0.3)",
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: "#fff",
    },
    locationChipActive: {
        backgroundColor: "#2d6a4f",
        borderColor: "#2d6a4f",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    locationChipText: {
        color: "#2d6a4f",
        fontWeight: "800",
        fontSize: 12,
    },
    locationChipTextActive: {
        color: "#fff",
    },
    imagePickerBtn: {
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.24)",
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
    },
    imagePickerText: {
        color: "#2e4d35",
        fontWeight: "800",
    },
    modalPreview: {
        width: "100%",
        height: 170,
        borderRadius: 14,
        marginTop: 10,
    },
    modalActions: {
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
    },
    secondaryBtn: {
        height: 42,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.9)",
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryText: {
        color: "#2e4d35",
        fontWeight: "900",
    },
    primaryBtnWide: {
        height: 42,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: "#2d6a4f",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 100,
    },
    primaryText: {
        color: "#fff",
        fontWeight: "900",
    },

});
