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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

export default function AddPlantScreen() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [location, setLocation] = useState("");
    const [date, setDate] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [successVisible, setSuccessVisible] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.85)).current;

    // 📸 Pick image from gallery
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
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
        }, 1500);
    };

    // 🌿 Save plant
    const savePlant = async () => {
        if (!name.trim()) return Alert.alert("Please enter the plant name 🌿");
        const formattedCategory = formatCategory(category);
        if (!formattedCategory)
            return Alert.alert("Category must be: Vegetable, Flower, Herb, Tree, or Indoor");

        try {
            const token = await AsyncStorage.getItem("access");
            if (!token) return Alert.alert("You must be logged in!");

            const formData = new FormData();
            formData.append("name", name);
            formData.append("category", formattedCategory);
            formData.append("location", location);
            if (date) formData.append("planting_date", date);

            if (image) {
                const filename = image.split("/").pop();
                const filetype = filename?.split(".").pop();
                formData.append("image", {
                    uri: image,
                    name: filename || "plant.jpg",
                    type: `image/${filetype}`,
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

            if (response.ok) showSuccessMessage();
            else {
                const err = await response.text();
                console.log("❌ Upload error:", err);
                Alert.alert("Failed to save plant.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Network Error", "Could not connect to the server.");
        }
    };


    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* HEADER */}
                <LinearGradient
                    colors={["#dbe6e1", "#f0f4f1", "#ffffff"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.header}
                >
                    <Text style={styles.title}>🌱 Add Your Plant</Text>
                    <Text style={styles.subtitle}>Grow your peaceful garden</Text>
                </LinearGradient>

                {/* IMAGE PICKER */}
                <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.imageContainer}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.image} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Feather name="camera" size={40} color="#8aa68a" />
                            <Text style={styles.imageText}>Upload a photo</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* FORM */}
                <View style={styles.formContainer}>
                    {[
                        { icon: "tag", placeholder: "Plant Name", value: name, set: setName },
                        {
                            icon: "layers",
                            placeholder: "Category (Vegetable / Flower / Herb / Tree / Indoor)",
                            value: category,
                            set: setCategory,
                        },
                        {
                            icon: "map-pin",
                            placeholder: "Location (Garden / Balcony / Room)",
                            value: location,
                            set: setLocation,
                        },
                        {
                            icon: "calendar",
                            placeholder: "Planting Date (YYYY-MM-DD)",
                            value: date,
                            set: setDate,
                        },
                    ].map((item, i) => (
                        <LinearGradient key={i} colors={["#ffffff", "#f7f7f7"]} style={styles.glassCard}>
                            <Feather name={item.icon as any} size={18} color="#4f6f50" style={styles.icon} />
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
                <TouchableOpacity activeOpacity={0.85} style={styles.saveButton} onPress={savePlant}>
                    <LinearGradient
                        colors={["#3e7c52", "#5f9c6c"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveGradient}
                    >
                        <Feather name="check-circle" size={24} color="#fff" />
                        <Text style={styles.saveText}>Save Plant</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>

            {/* SUCCESS OVERLAY */}
            {successVisible && (
                <Animated.View style={[styles.successOverlay, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                    <LinearGradient
                        colors={["#d8f3dc", "#b7e4c7"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.successCard}
                    >
                        <Feather name="check" size={42} color="#2b5938" />
                        <Text style={styles.successText}>Plant Added Successfully!</Text>
                    </LinearGradient>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#f9faf9" },
    header: {
        paddingVertical: 50,
        paddingHorizontal: 25,
        borderBottomLeftRadius: 50,
        borderBottomRightRadius: 50,
        shadowColor: "#5f9c6c",
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    title: { fontSize: 30, fontWeight: "bold", color: "#355e3b", textAlign: "center" },
    subtitle: { fontSize: 15, color: "#5f9c6c", textAlign: "center", marginTop: 8, fontStyle: "italic" },
    imageContainer: {
        marginTop: -40,
        alignSelf: "center",
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: "#ffffff",
        shadowColor: "#5f9c6c",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    image: { width: "100%", height: "100%" },
    imagePlaceholder: { justifyContent: "center", alignItems: "center" },
    imageText: { marginTop: 8, color: "#666", fontSize: 14 },
    formContainer: { marginTop: 40, paddingHorizontal: 25, gap: 14 },
    glassCard: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 15,
        backgroundColor: "rgba(255,255,255,0.8)",
        shadowColor: "#3e7c52",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 4,
    },
    icon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: "#333" },
    saveButton: {
        marginTop: 40,
        alignSelf: "center",
        borderRadius: 50,
        overflow: "hidden",
        shadowColor: "#3e7c52",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    saveGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 50,
    },
    saveText: { color: "#fff", fontWeight: "700", fontSize: 18, marginLeft: 10 },
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
    successText: { fontSize: 18, fontWeight: "700", color: "#2b5938", marginTop: 12 },
});
