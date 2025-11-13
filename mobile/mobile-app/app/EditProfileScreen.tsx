import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    ScrollView,
    ActivityIndicator,
    Modal,
    Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";

export default function EditProfileScreen() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);
    const [serverAvatar, setServerAvatar] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [successVisible, setSuccessVisible] = useState(false);
    const scaleAnim = useRef(new Animated.Value(0)).current;

    const showSuccess = () => {
        setSuccessVisible(true);
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            useNativeDriver: true,
        }).start();
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = await AsyncStorage.getItem("access");
                if (!token) return;

                const res = await fetch("http://10.0.2.2:8000/api/users/me/", {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const text = await res.text();
                console.log("PROFILE RAW:", text);

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    return;
                }

                setUsername(data.username);
                setEmail(data.email);

                if (data.avatar) {
                    const fullUrl = data.avatar.startsWith("http")
                        ? data.avatar
                        : `http://10.0.2.2:8000${data.avatar}`;
                    setAvatar(fullUrl);
                    setServerAvatar(fullUrl);
                }
            } catch (error) {
                console.error(error);
            }
        };

        fetchProfile();
    }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const saveProfile = async () => {
        if (!username.trim() || !email.trim()) {
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem("access");
            if (!token) return;

            const formData = new FormData();
            formData.append("username", username);
            formData.append("email", email);

            if (avatar && avatar !== serverAvatar) {
                const filename = avatar.split("/").pop() || "avatar.jpg";
                const ext = filename.split(".").pop();
                formData.append("avatar", {
                    uri: avatar,
                    name: filename,
                    type: `image/${ext || "jpeg"}`,
                } as any);
            }

            const res = await fetch("http://10.0.2.2:8000/api/users/update/", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
                body: formData,
            });

            const raw = await res.text();
            console.log("UPDATE RAW:", raw);

            let data;
            try {
                data = JSON.parse(raw);
            } catch (e) {
                return;
            }

            if (res.ok) {
                showSuccess();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <LinearGradient
                colors={["#d8f3dc", "#f6fff8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <Text style={styles.title}>Edit Profile 🌱</Text>
            </LinearGradient>

            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Feather name="camera" size={40} color="#74c69d" />
                        <Text style={{ color: "#4a7856" }}>Upload Photo</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Feather name="user" size={18} color="#4a7856" style={styles.icon} />
                    <TextInput
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                        style={styles.input}
                        placeholderTextColor="#888"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Feather name="mail" size={18} color="#4a7856" style={styles.icon} />
                    <TextInput
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        style={styles.input}
                        placeholderTextColor="#888"
                    />
                </View>
            </View>

            <TouchableOpacity
                style={styles.saveButton}
                onPress={saveProfile}
                disabled={loading}
            >
                <LinearGradient
                    colors={["#74c69d", "#52b788"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveGradient}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Feather name="check-circle" size={22} color="#fff" />
                            <Text style={styles.saveText}>Save Changes</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* SUCCESS POPUP */}
            <Modal transparent visible={successVisible} animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View
                        style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}
                    >
                        <Feather name="check-circle" size={60} color="#4CAF50" />
                        <Text style={styles.modalTitle}>Profile Updated! 🌿</Text>
                        <Text style={styles.modalMessage}>
                            Your profile has been updated successfully.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => {
                                setSuccessVisible(false);
                                router.back();
                            }}
                        >
                            <Text style={styles.modalButtonText}>Continue</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fdfdfd" },
    header: {
        paddingVertical: 45,
        alignItems: "center",
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        shadowColor: "#74c69d",
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    title: { fontSize: 26, fontWeight: "bold", color: "#1b4332" },
    avatarContainer: {
        alignSelf: "center",
        marginTop: -40,
        width: 150,
        height: 150,
        borderRadius: 75,
        overflow: "hidden",
        shadowColor: "#52b788",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    avatar: { width: "100%", height: "100%" },
    avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
    form: { marginTop: 40, paddingHorizontal: 25, gap: 16 },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: "#d8f3dc",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    icon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, color: "#333" },
    saveButton: {
        marginTop: 40,
        alignSelf: "center",
        borderRadius: 50,
        overflow: "hidden",
        shadowColor: "#52b788",
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    saveGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 50,
        paddingVertical: 16,
        borderRadius: 50,
    },
    saveText: { color: "#fff", fontWeight: "700", fontSize: 17, marginLeft: 8 },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalCard: {
        width: "80%",
        backgroundColor: "#fff",
        padding: 25,
        borderRadius: 20,
        alignItems: "center",
        elevation: 8,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#333",
        marginTop: 15,
    },
    modalMessage: {
        fontSize: 15,
        textAlign: "center",
        color: "#555",
        marginVertical: 10,
    },
    modalButton: {
        backgroundColor: "#4CAF50",
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 10,
        marginTop: 10,
    },
    modalButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});
