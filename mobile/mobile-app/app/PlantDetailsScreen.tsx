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
    Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { createPrediction, PredictionResult } from "../services/predictionApi";
import { useTranslation } from 'react-i18next';

// -----------------------------------------------------
// COUNTDOWN (unchanged)
// -----------------------------------------------------
function countdown(lastAction: string | null, intervalDays: number, t: any) {
    if (!lastAction || !intervalDays) return t('plantDetails.notSet');

    const last = new Date(lastAction).getTime();
    const now = Date.now();

    const next = last + intervalDays * 86400000; // next due time
    const diff = next - now;

    // ⛔ OVERDUE
    if (diff < 0) {
        const overdueMins = Math.floor(Math.abs(diff) / 60000);
        const hours = Math.floor(overdueMins / 60);
        const mins = overdueMins % 60;

        if (hours > 0) return t('plantDetails.overdueHoursMinutes', { hours, mins });
        return t('plantDetails.overdueMinutes', { mins });
    }

    // ⏱️ NORMAL COUNTDOWN
    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return t('plantDetails.timeDaysHoursMinutes', { days, hours, minutes });
    if (hours > 0) return t('plantDetails.timeHoursMinutes', { hours, minutes });
    return t('plantDetails.timeMinutes', { minutes });
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

function getHealthGrade(score: number, t: any) {
    if (score >= 85) return { label: t('plantDetails.excellent'), color: "#2d7d46" };
    if (score >= 70) return { label: t('plantDetails.good'), color: "#4f9f5f" };
    if (score >= 50) return { label: t('plantDetails.fair'), color: "#c28b2f" };
    return { label: t('plantDetails.poor'), color: "#b3541e" };
}

export default function PlantDetailsScreen() {
    const { t, i18n } = useTranslation();
    const { id } = useLocalSearchParams();
    const [plant, setPlant] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [healthScore, setHealthScore] = useState<any>(null);
    const [weatherStatus, setWeatherStatus] = useState<any>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [predictionImageUri, setPredictionImageUri] = useState<string | null>(null);
    const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
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

            const ws = await fetch(`http://10.0.2.2:8000/api/weather/plants/${id}/status/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (ws.ok) {
                const weatherData = await ws.json();
                setWeatherStatus(weatherData);
            }

            const hs = await fetch(`http://10.0.2.2:8000/api/plants/${id}/health-score/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (hs.ok) {
                const healthData = await hs.json();
                setHealthScore(healthData);
            }

            setLoading(false);
        } catch (e) {
            console.log("LOAD ERROR:", e);
            setLoading(false);
        }
    };

    const refreshWeather = async () => {
        try {
            setWeatherLoading(true);
            const token = await AsyncStorage.getItem("access");

            await fetch(`http://10.0.2.2:8000/api/weather/plants/${id}/sync/`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            await fetch("http://10.0.2.2:8000/api/weather/evaluate/", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const statusRes = await fetch(`http://10.0.2.2:8000/api/weather/plants/${id}/status/`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (statusRes.ok) {
                const weatherData = await statusRes.json();
                setWeatherStatus(weatherData);
            } else {
                Alert.alert(t('plantDetails.weather'), t('plantDetails.weatherFetchFailed'));
            }
        } catch (e) {
            Alert.alert(t('plantDetails.weather'), t('plantDetails.weatherRefreshFailed'));
        } finally {
            setWeatherLoading(false);
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

    const runDiseaseDetection = async () => {
        try {
            const token = await AsyncStorage.getItem("access");
            if (!token) {
                Alert.alert(t('plantDetails.aiDetection'), t('auth.loginRequired'));
                return;
            }

            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.85,
                allowsEditing: false,
            });

            if (picked.canceled || !picked.assets?.length) {
                return;
            }

            const uri = picked.assets[0].uri;
            setPredictionImageUri(uri);
            setPredictionLoading(true);

            const result = await createPrediction(token, uri, Number(id), i18n.language);
            setPredictionResult(result);
        } catch (e: any) {
            Alert.alert(t('plantDetails.aiDetection'), e?.message || t('plantDetails.aiDetectionFailed'));
        } finally {
            setPredictionLoading(false);
        }
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
                        <Text style={styles.actionBtnText}>{t('plants.water')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.sunBtn]}
                        onPress={() => doAction("Sunlight")}
                    >
                        <Feather name="sun" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>{t('plants.sunlight')}</Text>
                    </TouchableOpacity>
                </View>

                {/* CARE SCHEDULE */}
                <Text style={styles.section}>{t('plants.careSchedule')}</Text>

                {/* WATERING CARD */}
                <View style={styles.card}>
                    <View style={styles.cardTop}>
                        <Feather name="droplet" size={22} color="#3e7c52" />
                        <Text style={styles.cardTitle}>{t('plants.watering')}</Text>
                    </View>

                    <Text style={styles.value}>
                        {t('plants.every')} <Text style={styles.bold}>{plant.watering_interval}</Text> {t('plants.days')}
                    </Text>

                    <Text style={styles.subValue}>
                        {countdown(plant.last_watered, plant.watering_interval, t)}
                    </Text>

                    <TouchableOpacity
                        onPress={() => {
                            setType("watering");
                            setInterval(String(plant.watering_interval));
                            setOpen(true);
                            animateModal();
                        }}
                    >
                        <Text style={styles.edit}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                </View>

                {/* SUNLIGHT CARD */}
                <View style={styles.card}>
                    <View style={styles.cardTop}>
                        <Feather name="sun" size={22} color="#f4c430" />
                        <Text style={styles.cardTitle}>{t('plants.sunlight')}</Text>
                    </View>

                    <Text style={styles.value}>
                        {t('plants.every')} <Text style={styles.bold}>{plant.sunlight_interval}</Text> {t('plants.days')}
                    </Text>

                    <Text style={styles.subValue}>
                        {countdown(plant.last_sunlight, plant.sunlight_interval, t)}
                    </Text>

                    <TouchableOpacity
                        onPress={() => {
                            setType("sunlight");
                            setInterval(String(plant.sunlight_interval));
                            setOpen(true);
                            animateModal();
                        }}
                    >
                        <Text style={styles.edit}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                </View>

                {/* HISTORY */}
                <Text style={styles.section}>{t('plants.careHistory')}</Text>

                {logs.length === 0 ? (
                    <Text style={styles.empty}>{t('plantDetails.noActivity')}</Text>
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

                <Text style={styles.section}>{t('plantDetails.plantHealthScore')}</Text>

                <View style={styles.card}>
                    {healthScore ? (
                        <>
                            <Text style={styles.healthScoreValue}>{healthScore.score}/100</Text>
                            <Text style={[styles.healthGrade, { color: getHealthGrade(healthScore.score, t).color }]}>
                                {getHealthGrade(healthScore.score, t).label}
                            </Text>
                            <Text style={styles.logDate}>{t('plantDetails.algorithm')}: {healthScore.version}</Text>

                            <View style={styles.subscoreRow}>
                                <Text style={styles.subscoreLabel}>{t('plantDetails.watering')}</Text>
                                <View style={styles.subscoreTrack}>
                                    <View style={[styles.subscoreFill, { width: `${Math.round((healthScore.watering_subscore || 0) * 100)}%` }]} />
                                </View>
                            </View>

                            <View style={styles.subscoreRow}>
                                <Text style={styles.subscoreLabel}>{t('plantDetails.fertilizing')}</Text>
                                <View style={styles.subscoreTrack}>
                                    <View style={[styles.subscoreFill, { width: `${Math.round((healthScore.fertilizing_subscore || 0) * 100)}%` }]} />
                                </View>
                            </View>

                            <View style={styles.subscoreRow}>
                                <Text style={styles.subscoreLabel}>{t('plantDetails.disease')}</Text>
                                <View style={styles.subscoreTrack}>
                                    <View style={[styles.subscoreFill, { width: `${Math.round((healthScore.disease_subscore || 0) * 100)}%` }]} />
                                </View>
                            </View>

                            <View style={styles.subscoreRow}>
                                <Text style={styles.subscoreLabel}>{t('plantDetails.growth')}</Text>
                                <View style={styles.subscoreTrack}>
                                    <View style={[styles.subscoreFill, { width: `${Math.round((healthScore.growth_subscore || 0) * 100)}%` }]} />
                                </View>
                            </View>

                            <View style={styles.subscoreRow}>
                                <Text style={styles.subscoreLabel}>{t('plantDetails.missedTasks')}</Text>
                                <View style={styles.subscoreTrack}>
                                    <View style={[styles.subscoreFill, { width: `${Math.round((healthScore.missed_subscore || 0) * 100)}%` }]} />
                                </View>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.empty}>{t('plantDetails.healthScoreNotAvailable')}</Text>
                    )}
                </View>

                <Text style={styles.section}>{t('plantDetails.smartWeather')}</Text>

                <View style={styles.card}>
                    <View style={styles.weatherHeaderRow}>
                        <Text style={styles.cardTitle}>{t('plantDetails.weatherIntelligence')}</Text>
                        <TouchableOpacity style={styles.refreshBtn} onPress={refreshWeather} disabled={weatherLoading}>
                            {weatherLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.refreshBtnText}>{t('plantDetails.refresh')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {weatherStatus?.snapshot ? (
                        <>
                            <Text style={styles.value}>{t('plantDetails.rainProbability24h')}: <Text style={styles.bold}>{Math.round((weatherStatus.snapshot.next24h_rain_prob_max || 0) * 100)}%</Text></Text>
                            <Text style={styles.value}>{t('plantDetails.rainAmount24h')}: <Text style={styles.bold}>{Number(weatherStatus.snapshot.next24h_rain_mm_sum || 0).toFixed(1)} mm</Text></Text>
                            <Text style={styles.value}>{t('plantDetails.tempMaxMin48h')}: <Text style={styles.bold}>{weatherStatus.snapshot.next48h_temp_max}° / {weatherStatus.snapshot.next48h_temp_min}°</Text></Text>
                            <Text style={styles.value}>{t('plantDetails.dynamicWateringInterval')}: <Text style={styles.bold}>{weatherStatus.dynamic_watering_interval}</Text> {t('plants.days')}</Text>

                            {weatherStatus.snapshot.heatwave_risk ? <Text style={styles.alertHeat}>{t('plantDetails.heatwaveAlert')} 🌡️</Text> : null}
                            {weatherStatus.snapshot.frost_risk ? <Text style={styles.alertFrost}>{t('plantDetails.frostWarning')} ❄️</Text> : null}
                        </>
                    ) : (
                        <Text style={styles.empty}>{t('plantDetails.noWeatherSnapshot')}</Text>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('plantDetails.recentSmartEvents')}</Text>
                    {!weatherStatus?.events || weatherStatus.events.length === 0 ? (
                        <Text style={styles.empty}>{t('plantDetails.noSmartEvents')}</Text>
                    ) : (
                        weatherStatus.events.slice(0, 5).map((event: any) => (
                            <View key={event.id} style={styles.weatherEventRow}>
                                <Text style={styles.logAction}>{event.event_type}</Text>
                                <Text style={styles.logDate}>{event.decision_reason}</Text>
                            </View>
                        ))
                    )}
                </View>

                <Text style={styles.section}>{t('plantDetails.aiDiseaseDetection')}</Text>

                <View style={styles.card}>
                    <View style={styles.weatherHeaderRow}>
                        <Text style={styles.cardTitle}>{t('plantDetails.scanPlantDisease')}</Text>
                        <TouchableOpacity
                            style={styles.refreshBtn}
                            onPress={runDiseaseDetection}
                            disabled={predictionLoading}
                        >
                            {predictionLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.refreshBtnText}>{t('plantDetails.analyze')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {predictionImageUri ? (
                        <Image source={{ uri: predictionImageUri }} style={styles.predictionImage} />
                    ) : (
                        <Text style={styles.empty}>{t('plantDetails.chooseLeafImage')}</Text>
                    )}

                    {predictionResult ? (
                        <View style={styles.predictionResultBox}>
                            <Text style={styles.value}>
                                {t('plantDetails.diseaseLabel')}: <Text style={styles.bold}>{predictionResult.disease_name || t('plantDetails.unknown')}</Text>
                            </Text>
                            <Text style={styles.value}>
                                {t('plantDetails.confidence')}: <Text style={styles.bold}>{predictionResult.confidence_score || t('plantDetails.na')}</Text>
                            </Text>
                            <Text style={styles.value}>
                                {t('plantDetails.urgency')}: <Text style={styles.bold}>{predictionResult.urgency_level || t('plantDetails.na')}</Text>
                            </Text>
                            <Text style={styles.value}>{t('plantDetails.treatment')}:</Text>
                            <Text style={styles.logDate}>{predictionResult.treatment_recommendation || t('plantDetails.noRecommendation')}</Text>
                        </View>
                    ) : null}
                </View>

                {/* MODAL */}
                <Modal transparent visible={open} animationType="fade">
                    <View style={styles.overlay}>
                        <Animated.View style={[styles.modal, { transform: [{ scale }] }]}>

                            <Text style={styles.modalTitle}>
                                {t('plantDetails.editInterval', { type: type === "watering" ? t('plants.watering') : t('plants.sunlight') })}
                            </Text>

                            <TextInput
                                style={styles.input}
                                value={interval}
                                keyboardType="numeric"
                                onChangeText={setInterval}
                            />

                            <TouchableOpacity style={styles.saveBtn} onPress={saveInterval}>
                                <Text style={styles.saveTxt}>{t('common.save')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Text style={styles.cancelTxt}>{t('common.cancel')}</Text>
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
        paddingVertical: 15,
        paddingHorizontal: 26,
        borderRadius: 20,
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 7,
    },

    waterBtn: { backgroundColor: "#2d6a4f" },
    sunBtn: { backgroundColor: "#52b788" },

    actionBtnText: {
        color: "#fff",
        fontWeight: "800",
        marginLeft: 10,
        fontSize: 16,
        letterSpacing: 0.3,
    },

    // CARD SECTION
    section: {
        marginLeft: 24,
        marginTop: 30,
        fontSize: 24,
        fontWeight: "900",
       color: "#1b4332",
        letterSpacing: -0.5,
    },

    card: {
        backgroundColor: "#ffffff",
        marginHorizontal: 20,
        marginTop: 16,
        padding: 24,
        borderRadius: 24,
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        borderWidth: 1,
        borderColor: "rgba(212,241,223,0.4)",
    },

    cardTop: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        gap: 12,
    },

    weatherHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },

    refreshBtn: {
        backgroundColor: "#2d6a4f",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        minWidth: 90,
        alignItems: "center",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
    },

    refreshBtnText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 14,
        letterSpacing: 0.3,
    },

    cardTitle: {
        fontSize: 20,
        fontWeight: "900",
        color: "#1b4332",
        letterSpacing: -0.3,
    },

    value: {
        fontSize: 16,
        color: "#2d6a4f",
        marginTop: 4,
        lineHeight: 22,
    },

    bold: { fontWeight: "900", color: "#1b4332" },

    subValue: {
        marginTop: 6,
        fontSize: 14,
        color: "#52b788",
        fontWeight: "600",
    },

    edit: {
        marginTop: 12,
        color: "#3e7c52",
        fontWeight: "900",
    },

    empty: {
        textAlign: "center",
        marginHorizontal: 20,
        padding: 18,
        borderRadius: 20,
        marginTop: 12,
        alignItems: "center",
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        borderWidth: 1,
        borderColor: "rgba(212,241,223,0.3)",
    },

    iconWrap: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
        backgroundColor: "rgba(82,183,136,0.15)",
        borderRadius: 10,
    },

    logAction: {
        fontSize: 17,
        fontWeight: "800",
        color: "#1b4332",
    },

    logDate: {
        marginTop: 4,
        fontSize: 13,
        color: "#3e7c52",
        fontWeight: "600",
    },

    weatherEventRow: {
        borderTopWidth: 1,
        borderTopColor: "#dce5dc",
        paddingTop: 10,
        marginTop: 10,
    },

    predictionImage: {
        width: "100%",
        height: 180,
        borderRadius: 14,
        marginTop: 8,
    },

    predictionResult: {
        fontSize: 42,
        fontWeight: "900",
        color: "#1b4332",
        marginBottom: 8,
        letterSpacing: -1,
    },

    healthGrade: {
        fontSize: 16,
        fontWeight: "900",
        marginBottom: 6,
    },

    subscoreRow: {
        marginTop: 12,
    },

    subscoreLabel: {
        fontSize: 14,
        color: "#2d6a4f",
        marginBottom: 6,
        fontWeight: "700",
    },

    subscoreTrack: {
        height: 10,
        borderRadius: 10,
        backgroundColor: "#e8f0eb",
        overflow: "hidden",
    },

    subscoreFill: {
        height: 10,
        borderRadius: 10,
        backgroundColor: "#2d6a4f",
    },

    alertHeat: {
        marginTop: 10,
        color: "#b3541e",
        fontWeight: "800",
    },

    alertFrost: {
        marginTop: 10,
        color: "#4a7c9e",
        fontWeight: "800",
    },

    modal: {
        width: "85%",
        backgroundColor: "#ffffff",
        padding: 28,
        borderRadius: 28,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },

    modalTitle: {
        fontSize: 24,
        fontWeight: "900",
        marginBottom: 20,
        color: "#1b4332",
        letterSpacing: -0.5,
    },

    input: {
        width: "100%",
        backgroundColor: "#f8faf9",
        padding: 16,
        borderRadius: 16,
        fontSize: 17,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: "rgba(82,183,136,0.25)",
        color: "#1b4332",
        fontWeight: "600",
    },

    saveBtn: {
        backgroundColor: "#2d6a4f",
        paddingVertical: 14,
        paddingHorizontal: 60,
        borderRadius: 16,
        shadowColor: "#2d6a4f",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    saveTxt: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 17,
        letterSpacing: 0.3,
    },

    cancelTxt: {
        marginTop: 12,
        color: "#7c8d7d",
        fontSize: 14,
    },

    log: {
        backgroundColor: "#ffffff",
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: "rgba(212,241,223,0.4)",
        flexDirection: "row",
        alignItems: "center",
    },

    healthScoreValue: {
        fontSize: 42,
        fontWeight: "900",
        color: "#1b4332",
        letterSpacing: -1,
    },

    predictionResultBox: {
        marginTop: 16,
        backgroundColor: "#f5f9f7",
        padding: 20,
        borderRadius: 16,
    },

    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(10,30,20,0.5)",
        zIndex: 999,
        justifyContent: "center",
        alignItems: "center",
    },
});
