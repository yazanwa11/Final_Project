import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    ScrollView,
    StyleSheet,
    Animated,
    Easing,
    Alert,
    ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from 'react-i18next';

export default function AddPlantScreen() {
    const { t } = useTranslation();
    const router = useRouter();

    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [location, setLocation] = useState("");
    const [date, setDate] = useState("");
    const [image, setImage] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);

    const [successVisible, setSuccessVisible] = useState(false);
    const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);

    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // 📸 Pick image from gallery
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,   // ✅ this is the key
            quality: 0.8,
        });

        if (!result.canceled) setImage(result.assets[0].uri);
    };

    // ✅ Format category properly
    const formatCategory = (input: string): string | null => {
        const clean = input.trim().toLowerCase() as
            | "vegetable"
            | "flower"
            | "herb"
            | "tree"
            | "indoor";

        const valid: Record<typeof clean, string> = {
            vegetable: "Vegetable",
            flower: "Flower",
            herb: "Herb",
            tree: "Tree",
            indoor: "Indoor",
        };

        return valid[clean] || null;
    };

    // ✅ Success animation
    const showSuccessMessage = () => {
        setSuccessVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 50,
                useNativeDriver: true,
            }),
        ]).start();

        setTimeout(() => {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                setSuccessVisible(false);
                router.replace("/(tabs)/MyPlantsScreen");
            });
        }, 1200);
    };

    // 🌿 Save plant
    const savePlant = async () => {
        if (saving) return;

        if (!name.trim()) return Alert.alert(t('plants.enterPlantName'));

        const formattedCategory = formatCategory(category);
        if (!formattedCategory)
            return Alert.alert(
                t('addPlant.invalidCategory')
            );

        try {
            setSaving(true);

            const token = await AsyncStorage.getItem("access");
            if (!token) return Alert.alert(t('auth.loginRequired'));

            // ✅ 1) Check duplicate before uploading
            const existingPlantsReq = await fetch("http://10.0.2.2:8000/api/plants/", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const existingPlants = await existingPlantsReq.json();

            const exists = existingPlants.some(
                (p: any) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
            );

            if (exists) {
                setDuplicateModalVisible(true);

                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 6,
                    useNativeDriver: true,
                }).start();

                return;
            }

            // ✅ 2) Proceed with upload
            const formData = new FormData();
            formData.append("name", name);
            formData.append("category", formattedCategory);
            formData.append("location", location);
            if (date) formData.append("planting_date", date);

            if (image) {
                const filename = image.split("/").pop() || "plant.jpg";
                const ext = filename.split(".").pop()?.toLowerCase();

                const mime =
                    ext === "png"
                        ? "image/png"
                        : ext === "jpg" || ext === "jpeg"
                            ? "image/jpeg"
                            : "image/jpeg";

                formData.append("image_file", {
                    uri: image,
                    name: filename,
                    type: mime,
                } as any);
            }


            const response = await fetch("http://10.0.2.2:8000/api/plants/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
                body: formData,
            });

            if (response.ok) {
                showSuccessMessage();
            } else {
                const err = await response.text();
                console.log("❌ Upload error:", err);
                Alert.alert(t('addPlant.saveFailed'));
            }
        } catch (e) {
            console.error(e);
            Alert.alert(t('common.error'), t('common.networkError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 110 }}
            >
                {/* HEADER */}
                <LinearGradient
                    colors={["#dbe6e1", "#f0f4f1", "#ffffff"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.header}
                >
                    <Text style={styles.title}>🌱 Add Your Plant</Text>
                    <Text style={styles.subtitle}>Grow your peaceful garden</Text>

                    {/* Modern Suggested Plants Button */}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => router.push("../suggested-plants")}
                        style={styles.suggestBtnWrap}
                    >
                        <LinearGradient
                            colors={["#74c69d", "#b7e4c7"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.suggestBtn}
                        >
                            <View style={styles.suggestLeft}>
                                <View style={styles.suggestIconCircle}>
                                    <Feather name="star" size={18} color="#1b4332" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.suggestTitle}>Suggested Plants</Text>
                                    <Text style={styles.suggestSub}>
                                        Pick a plant with ready schedule
                                    </Text>
                                </View>
                            </View>

                            <Feather name="chevron-right" size={20} color="#1b4332" />
                        </LinearGradient>
                    </TouchableOpacity>
                </LinearGradient>

                {/* IMAGE PICKER */}
                <TouchableOpacity
                    onPress={pickImage}
                    activeOpacity={0.8}
                    style={styles.imageContainer}
                >
                    {image ? (
                        <Image source={{ uri: image }} style={styles.image} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Feather name="camera" size={40} color="#8aa68a" />
                            <Text style={styles.imageText}>{t('addPlant.uploadPhoto')}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* FORM */}
                <View style={styles.formContainer}>
                    {[
                        { icon: "tag", placeholder: t('addPlant.plantName'), value: name, set: setName },
                        {
                            icon: "layers",
                            placeholder: t('addPlant.categoryPlaceholder'),
                            value: category,
                            set: setCategory,
                        },
                        {
                            icon: "map-pin",
                            placeholder: t('addPlant.locationPlaceholder'),
                            value: location,
                            set: setLocation,
                        },
                        {
                            icon: "calendar",
                            placeholder: t('addPlant.plantingDate'),
                            value: date,
                            set: setDate,
                        },
                    ].map((item, i) => (
                        <LinearGradient
                            key={i}
                            colors={["#ffffff", "#f7f7f7"]}
                            style={styles.glassCard}
                        >
                            <Feather
                                name={item.icon as any}
                                size={18}
                                color="#4f6f50"
                                style={styles.icon}
                            />
                            <TextInput
                                placeholder={item.placeholder}
                                placeholderTextColor="#999"
                                value={item.value}
                                onChangeText={item.set}
                                style={styles.input}
                            />
                        </LinearGradient>
                    ))}
                </View>

                {/* SAVE BUTTON */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.saveButton, saving && { opacity: 0.85 }]}
                    onPress={savePlant}
                    disabled={saving}
                >
                    <LinearGradient
                        colors={["#3e7c52", "#5f9c6c"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveGradient}
                    >
                        {saving ? (
                            <>
                                <ActivityIndicator color="#fff" />
                                <Text style={styles.saveText}>{t('common.saving')}</Text>
                            </>
                        ) : (
                            <>
                                <Feather name="check-circle" size={24} color="#fff" />
                                <Text style={styles.saveText}>{t('addPlant.savePlant')}</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>

            {/* SUCCESS OVERLAY */}
            {successVisible && (
                <Animated.View
                    style={[
                        styles.successOverlay,
                        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <LinearGradient
                        colors={["#d8f3dc", "#b7e4c7"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.successCard}
                    >
                        <Feather name="check" size={42} color="#2b5938" />
                        <Text style={styles.successText}>{t('addPlant.plantAdded')}</Text>
                    </LinearGradient>
                </Animated.View>
            )}

            {/* DUPLICATE MODAL */}
            {duplicateModalVisible && (
                <View style={styles.overlay}>
                    <Animated.View
                        style={[styles.duplicateModal, { transform: [{ scale: scaleAnim }] }]}
                    >
                        <View style={styles.iconCircle}>
                            <Feather name="alert-triangle" size={40} color="#3e7c52" />
                        </View>

                        <Text style={styles.dupTitle}>{t('addPlant.plantAlreadyExists')}</Text>
                        <Text style={styles.dupMessage}>
                            {t('addPlant.chooseDifferentName')}
                        </Text>

                        <TouchableOpacity
                            style={styles.dupButton}
                            onPress={() => setDuplicateModalVisible(false)}
                        >
                            <Text style={styles.dupButtonText}>{t('common.ok')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#f9faf9" },

    header: {
        paddingVertical: 44,
        paddingHorizontal: 22,
        borderBottomLeftRadius: 50,
        borderBottomRightRadius: 50,
        shadowColor: "#5f9c6c",
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },

    title: {
        fontSize: 30,
        fontWeight: "bold",
        color: "#355e3b",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#5f9c6c",
        textAlign: "center",
        marginTop: 8,
        fontStyle: "italic",
    },

    // Suggested button inside header
    suggestBtnWrap: {
        marginTop: 18,
        alignSelf: "center",
        width: "100%",
        maxWidth: 420,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.10,
        shadowRadius: 10,
        elevation: 6,
    },
    suggestBtn: {
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.18)",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    suggestLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
        paddingRight: 10,
    },
    suggestIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.7)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.15)",
    },
    suggestTitle: {
        fontSize: 15.5,
        fontWeight: "900",
        color: "#1b4332",
    },
    suggestSub: {
        marginTop: 2,
        fontSize: 12.5,
        color: "#3a6b52",
    },

    imageContainer: {
        marginTop: -40,
        alignSelf: "center",
        width: 190,
        height: 190,
        borderRadius: 95,
        backgroundColor: "#ffffff",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "rgba(212,241,223,0.6)",
    },
    image: { width: "100%", height: "100%" },
    imagePlaceholder: { justifyContent: "center", alignItems: "center" },
    imageText: { marginTop: 8, color: "#52b788", fontSize: 15, fontWeight: "600" },

    formContainer: { marginTop: 38, paddingHorizontal: 28, gap: 16 },
    glassCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 18,
        backgroundColor: "#ffffff",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
        borderWidth: 1.5,
        borderColor: "rgba(212,241,223,0.4)",
    },
    icon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: "#1b4332", fontWeight: "600" },

    saveButton: {
        marginTop: 40,
        alignSelf: "center",
        borderRadius: 50,
        overflow: "hidden",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
    },
    saveGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 48,
        paddingVertical: 18,
        borderRadius: 50,
        gap: 12,
    },
    saveText: { color: "#fff", fontWeight: "900", fontSize: 19, letterSpacing: 0.3 },

    successOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    successCard: {
        paddingVertical: 30,
        paddingHorizontal: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#3e7c52",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    successText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#2b5938",
        marginTop: 12,
    },

    // Duplicate Modal
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(10,30,20,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    duplicateModal: {
        width: "85%",
        backgroundColor: "#ffffff",
        padding: 30,
        borderRadius: 28,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 15,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#e8f0eb",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 18,
    },
    dupTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: "#1b4332",
        marginBottom: 10,
        textAlign: "center",
        letterSpacing: -0.5,
    },
    dupMessage: {
        fontSize: 16,
        color: "#52b788",
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    dupButton: {
        backgroundColor: "#2d6a4f",
        paddingVertical: 14,
        paddingHorizontal: 50,
        borderRadius: 16,
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    dupButtonText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 17,
        letterSpacing: 0.3,
    },
});
