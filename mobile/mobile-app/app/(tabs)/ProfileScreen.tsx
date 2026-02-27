import React, { useState, useRef, useCallback } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
    const { t, i18n } = useTranslation();
    const [user, setUser] = useState<{
        username: string;
        email: string;
        avatar?: string | null;
    } | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

    // Fetch user whenever screen is focused
    useFocusEffect(
        useCallback(() => {
            const fetchUser = async () => {
                try {
                    const token = await AsyncStorage.getItem("access");
                    if (!token) return;

                    const res = await fetch("http://10.0.2.2:8000/api/users/me/", {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (res.ok) {
                        const data = await res.json();
                        console.log("PROFILE FETCHED:", data);
                        setUser(data);
                    }
                } catch (err) {
                    console.error(err);
                }
            };

            fetchUser();

            // Fade animation start
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 900,
                useNativeDriver: true,
            }).start();
        }, [])
    );

    const handleLogout = async () => {
        Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
            { text: t('common.cancel'), style: "cancel" },
            {
                text: t('profile.logout'),
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
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#fdfdfd" />
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{t('profile.title')}</Text>
                </View>

                {/* Profile Card */}
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
                        <Text style={styles.editText}>{t('profile.editProfile')}</Text>
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>8</Text>
                        <Text style={styles.statLabel}>{t('profile.plants')}</Text>
                    </View>

                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>3</Text>
                        <Text style={styles.statLabel}>{t('profile.tasks')}</Text>
                    </View>

                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>75%</Text>
                        <Text style={styles.statLabel}>{t('profile.progress')}</Text>
                    </View>
                </View>

                {/* Language Settings */}
                <View style={styles.settingsBox}>
                    <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
                    <View style={styles.languageContainer}>
                        <TouchableOpacity
                            style={[
                                styles.languageButton,
                                currentLanguage === 'he' && styles.languageButtonActive
                            ]}
                            onPress={() => changeLanguage('he')}
                        >
                            <Text style={[
                                styles.languageText,
                                currentLanguage === 'he' && styles.languageTextActive
                            ]}>
                                🇮🇱 {t('profile.hebrew')}
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[
                                styles.languageButton,
                                currentLanguage === 'en' && styles.languageButtonActive
                            ]}
                            onPress={() => changeLanguage('en')}
                        >
                            <Text style={[
                                styles.languageText,
                                currentLanguage === 'en' && styles.languageTextActive
                            ]}>
                                🇺🇸 {t('profile.english')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* About */}
                <View style={styles.aboutBox}>
                    <Text style={styles.sectionTitle}>{t('profile.aboutMe')}</Text>
                    <Text style={styles.aboutText}>
                        {t('profile.aboutText')}
                    </Text>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>{t('profile.logout')}</Text>
                </TouchableOpacity>

                {/* Footer */}
                <Text style={styles.footer}>{t('profile.footer')}</Text>
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fdfdfd",
    },
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 80,
    },
    header: {
        alignItems: "center",
        marginBottom: 25,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#333",
    },
    profileCard: {
        backgroundColor: "#fff",
        borderRadius: 20,
        alignItems: "center",
        paddingVertical: 30,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
        marginBottom: 25,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
        borderWidth: 2,
        borderColor: "#4CAF50",
    },
    username: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#333",
    },
    email: {
        fontSize: 15,
        color: "#777",
        marginBottom: 15,
    },
    editButton: {
        backgroundColor: "#4CAF50",
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 10,
    },
    editText: {
        color: "#fff",
        fontWeight: "bold",
    },
    statsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 25,
    },
    statBox: {
        backgroundColor: "#E8F5E9",
        borderRadius: 16,
        width: "30%",
        alignItems: "center",
        paddingVertical: 20,
    },
    statValue: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#4CAF50",
    },
    statLabel: {
        color: "#666",
        marginTop: 5,
    },
    settingsBox: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: 20,
    },
    languageContainer: {
        flexDirection: "row",
        gap: 12,
        marginTop: 12,
    },
    languageButton: {
        flex: 1,
        backgroundColor: "#f5f5f5",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 2,
        borderColor: "transparent",
    },
    languageButtonActive: {
        backgroundColor: "#E8F5E9",
        borderColor: "#4CAF50",
    },
    languageText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#666",
    },
    languageTextActive: {
        color: "#4CAF50",
        fontWeight: "700",
    },
    aboutBox: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 8,
    },
    aboutText: {
        fontSize: 15,
        color: "#666",
        lineHeight: 22,
    },
    logoutButton: {
        backgroundColor: "#f44336",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 15,
    },
    logoutText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    footer: {
        textAlign: "center",
        color: "#999",
        fontSize: 12,
        marginTop: 10,
    },
});
