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
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { getBestDeviceLocation } from "../services/locationService";

type SuggestedPlant = {
    id?: number;
    name: string;
    category: string;
    watering_interval: number;
    sunlight_interval: number;
    image?: string;
};

const MY_PLANTS_ROUTE = "/(tabs)/MyPlantsScreen";
const QUOTA_BLOCK_UNTIL_KEY = "suggestions_quota_block_until_ms";
const SUGGESTIONS_CACHE_KEY = "suggestions_last_success_v1";

function normalizeQuery(value: string): string {
    return (value || "").trim().toLowerCase();
}

function filterSuggestionsByQuery(items: SuggestedPlant[], queryText: string): SuggestedPlant[] {
    const q = normalizeQuery(queryText);
    if (!q) {
        return items;
    }
    return items.filter((item) => {
        const name = normalizeQuery(item.name || "");
        const category = normalizeQuery(item.category || "");
        return name.includes(q) || category.includes(q);
    });
}

function mergeWithCachedImages(incoming: SuggestedPlant[], cached: SuggestedPlant[]): SuggestedPlant[] {
    const byId = new Map<number, SuggestedPlant>();
    const byName = new Map<string, SuggestedPlant>();

    for (const item of cached) {
        if (typeof item.id === "number") {
            byId.set(item.id, item);
        }
        byName.set(normalizeQuery(item.name || ""), item);
    }

    return incoming.map((item) => {
        if (item.image) {
            return item;
        }

        let cachedItem: SuggestedPlant | undefined;
        if (typeof item.id === "number") {
            cachedItem = byId.get(item.id);
        }
        if (!cachedItem) {
            cachedItem = byName.get(normalizeQuery(item.name || ""));
        }

        if (cachedItem?.image) {
            return { ...item, image: cachedItem.image };
        }

        return item;
    });
}

export default function SuggestedPlantsScreen() {
    const { t } = useTranslation();
    const [plants, setPlants] = useState<SuggestedPlant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState("");
    const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
    const [locationSuggesting, setLocationSuggesting] = useState(false);
    const quotaBlockedUntilRef = useRef<number>(0);

    const [selected, setSelected] = useState<SuggestedPlant | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [adding, setAdding] = useState(false);

    // Duplicate modal
    const [dupVisible, setDupVisible] = useState(false);
    const dupScale = useRef(new Animated.Value(0.85)).current;
    const firstSearchRender = useRef(true);
    const cooldownProbeTriedRef = useRef(false);

    async function loadCachedSuggestions(): Promise<SuggestedPlant[]> {
        try {
            const raw = await AsyncStorage.getItem(SUGGESTIONS_CACHE_KEY);
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed as SuggestedPlant[];
        } catch {
            return [];
        }
    }

    async function saveCachedSuggestions(items: SuggestedPlant[]) {
        try {
            await AsyncStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify(items));
        } catch {
            // ignore cache write failures
        }
    }

    useEffect(() => {
        const initializeSuggestions = async () => {
            try {
                const savedBlockedUntil = await AsyncStorage.getItem(QUOTA_BLOCK_UNTIL_KEY);
                const blockedUntil = Number(savedBlockedUntil || 0);
                const now = Date.now();

                if (Number.isFinite(blockedUntil) && blockedUntil > now) {
                    quotaBlockedUntilRef.current = blockedUntil;
                    const remainingSeconds = Math.ceil((blockedUntil - now) / 1000);
                    const retryHours = Math.max(1, Math.ceil(remainingSeconds / 3600));
                    setFetchErrorMessage(`Provider temporarily unavailable. Try again in ~${retryHours}h.`);
                    const cached = await loadCachedSuggestions();
                    setPlants(filterSuggestionsByQuery(cached, ""));
                    if (cached.length > 0) {
                        setLoading(false);
                        return;
                    }
                }

                if (savedBlockedUntil) {
                    await AsyncStorage.removeItem(QUOTA_BLOCK_UNTIL_KEY);
                }
            } catch {
                // Continue with normal fetch if storage is unavailable
            }

            fetchSuggestions("");
        };

        initializeSuggestions();
    }, []);

    useEffect(() => {
        if (firstSearchRender.current) {
            firstSearchRender.current = false;
            return;
        }

        const id = setTimeout(() => {
            fetchSuggestions(query, true);
        }, 350);

        return () => clearTimeout(id);
    }, [query]);

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

    const fetchSuggestions = async (
        searchValue: string = "",
        isSearch: boolean = false,
        options: {
            bestForLocation?: boolean;
            latitude?: number;
            longitude?: number;
            locationLabel?: string;
        } = {}
    ) => {
        try {
            if (isSearch) {
                setSearching(true);
            }

            if (options.bestForLocation) {
                setLocationSuggesting(true);
            }

            const now = Date.now();
            if (quotaBlockedUntilRef.current > now && !options.bestForLocation) {
                const remainingSeconds = Math.ceil((quotaBlockedUntilRef.current - now) / 1000);
                const retryMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
                if (retryMinutes >= 60) {
                    const retryHours = Math.max(1, Math.ceil(retryMinutes / 60));
                    setFetchErrorMessage(`Provider temporarily unavailable. Try again in ~${retryHours}h.`);
                } else {
                    setFetchErrorMessage(`Provider temporarily unavailable. Try again in ~${retryMinutes}m.`);
                }
                const cached = await loadCachedSuggestions();
                const filteredCached = filterSuggestionsByQuery(cached, searchValue);
                setPlants(filteredCached);

                const canProbeBackend =
                    !cooldownProbeTriedRef.current &&
                    !isSearch &&
                    !searchValue.trim() &&
                    filteredCached.length === 0;

                if (!canProbeBackend) {
                    return;
                }

                cooldownProbeTriedRef.current = true;
            }

            const q = searchValue.trim();
            const params = new URLSearchParams();
            if (q) {
                params.set("q", q);
            }
            if (options.bestForLocation) {
                params.set("best_for_location", "1");
                if (typeof options.latitude === "number" && typeof options.longitude === "number") {
                    params.set("latitude", String(options.latitude));
                    params.set("longitude", String(options.longitude));
                }
                if (options.locationLabel) {
                    params.set("location_label", options.locationLabel);
                }
            }
            const queryString = params.toString();
            const url = queryString
                ? `http://10.0.2.2:8000/api/plants/suggestions/?${queryString}`
                : "http://10.0.2.2:8000/api/plants/suggestions/";

            const response = await fetchWithAuth(url, {
                headers: { Accept: "application/json" },
            });

            const raw = await response.text();

            let parsed: any = null;
            if (raw) {
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    parsed = null;
                }
            }

            if (!response.ok) {
                const retryAfter = Number(parsed?.retry_after_seconds);
                if (response.status === 429 || (response.status === 503 && Number.isFinite(retryAfter) && retryAfter > 0)) {
                    const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0
                        ? retryAfter
                        : response.status === 429
                            ? 60 * 60
                            : 3 * 60;

                    const blockedUntil = Date.now() + waitSeconds * 1000;
                    quotaBlockedUntilRef.current = blockedUntil;
                    await AsyncStorage.setItem(QUOTA_BLOCK_UNTIL_KEY, String(blockedUntil));

                    if (waitSeconds >= 3600) {
                        const retryHours = Math.max(1, Math.ceil(waitSeconds / 3600));
                        setFetchErrorMessage(`Provider temporarily unavailable. Try again in ~${retryHours}h.`);
                    } else {
                        const retryMinutes = Math.max(1, Math.ceil(waitSeconds / 60));
                        setFetchErrorMessage(`Provider temporarily unavailable. Try again in ~${retryMinutes}m.`);
                    }
                } else if (response.status === 503) {
                    const blockedUntil = Date.now() + 3 * 60 * 1000;
                    quotaBlockedUntilRef.current = blockedUntil;
                    await AsyncStorage.setItem(QUOTA_BLOCK_UNTIL_KEY, String(blockedUntil));
                    setFetchErrorMessage("Plant provider unavailable. Try again in a few minutes.");
                } else if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
                    setFetchErrorMessage(parsed.detail.trim());
                } else {
                    setFetchErrorMessage(`Failed to fetch suggestions (${response.status}).`);
                }
                const cached = await loadCachedSuggestions();
                setPlants(filterSuggestionsByQuery(cached, searchValue));
                return;
            }

            const data = parsed;
            if (!Array.isArray(data)) {
                setFetchErrorMessage("Invalid suggestions response from server.");
                const cached = await loadCachedSuggestions();
                setPlants(filterSuggestionsByQuery(cached, searchValue));
                return;
            }

            const cached = await loadCachedSuggestions();
            const merged = mergeWithCachedImages(data as SuggestedPlant[], cached);
            setPlants(merged);
            setFetchErrorMessage(null);
            quotaBlockedUntilRef.current = 0;
            await AsyncStorage.removeItem(QUOTA_BLOCK_UNTIL_KEY);
            await saveCachedSuggestions(merged);
        } catch (err) {
            console.warn("Failed to fetch suggestions", err);
            setFetchErrorMessage("Could not load suggestions. Please try again.");
            const cached = await loadCachedSuggestions();
            setPlants(filterSuggestionsByQuery(cached, searchValue));
        } finally {
            setSearching(false);
            setLocationSuggesting(false);
            setLoading(false);
        }
    };

    const fetchBestForMyLocation = async () => {
        try {
            const location = await getBestDeviceLocation({ forceFresh: true });
            if (!location) {
                setFetchErrorMessage(t("suggestedPlants.locationUnavailable"));
                return;
            }

            await fetchSuggestions(query, false, {
                bestForLocation: true,
                latitude: location.latitude,
                longitude: location.longitude,
                locationLabel: location.label,
            });
        } catch {
            setFetchErrorMessage(t("suggestedPlants.locationUnavailable"));
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
                    <Text style={styles.title}>{t('suggestedPlants.title')}</Text>
                    <Text style={styles.subtitle}>{t('suggestedPlants.subtitle')}</Text>

                    <View style={styles.searchBar}>
                        <Feather name="search" size={16} color="#2d6a4f" />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder={t("explore.searchPlaceholder")}
                            placeholderTextColor="#6f907e"
                            style={styles.searchInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                        />

                        {searching ? (
                            <ActivityIndicator size="small" color="#2d6a4f" />
                        ) : query.length > 0 ? (
                            <Pressable onPress={() => setQuery("")}>
                                <Feather name="x" size={16} color="#2d6a4f" />
                            </Pressable>
                        ) : null}
                    </View>

                    <Pressable
                        style={[styles.locationBtn, locationSuggesting && { opacity: 0.85 }]}
                        onPress={fetchBestForMyLocation}
                        disabled={locationSuggesting}
                    >
                        {locationSuggesting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Feather name="map-pin" size={16} color="#ffffff" />
                        )}
                        <Text style={styles.locationBtnText}>
                            {locationSuggesting
                                ? t("suggestedPlants.findingByLocation")
                                : t("suggestedPlants.bestForMyLocation")}
                        </Text>
                    </Pressable>

                    {!!query.trim() && (
                        <Text style={styles.searchMeta}>{t('explore.plantMatches')}: {plants.length}</Text>
                    )}

                    <FlatList
                        data={plants}
                        keyExtractor={(item, index) => (item.id ? String(item.id) : item.name + index)}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Feather name="search" size={22} color="#2d6a4f" />
                                <Text style={styles.emptyTitle}>{t('suggestedPlants.noSuggestionsYet')}</Text>
                                <Text style={styles.emptyText}>{fetchErrorMessage || t('suggestedPlants.tryAgainLater')}</Text>
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
                                            <Text style={styles.pillText}>💧 {item.watering_interval}{t('home.daysShort')}</Text>
                                        </View>
                                        <View style={styles.pill}>
                                            <Text style={styles.pillText}>☀️ {item.sunlight_interval}{t('home.daysShort')}</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.hint} numberOfLines={1}>
                                        {t('suggestedPlants.tapToAdd')}
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
                            <Text style={styles.modalTitle}>{t('suggestedPlants.addThisPlant')}</Text>

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
                                    <Text style={styles.modalMeta}>💧 {t('suggestedPlants.everyXDays', { days: selected?.watering_interval })}</Text>
                                    <Text style={styles.modalMeta}>☀️ {t('suggestedPlants.everyXDays', { days: selected?.sunlight_interval })}</Text>
                                </View>
                            </View>

                            <View style={styles.modalActions}>
                                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setConfirmOpen(false)} disabled={adding}>
                                    <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.btn, styles.btnPrimary, adding && { opacity: 0.85 }]}
                                    onPress={() => selected && addSuggestedPlant(selected)}
                                    disabled={adding}
                                >
                                    <Text style={styles.btnPrimaryText}>{adding ? t('suggestedPlants.adding') : t('suggestedPlants.addPlant')}</Text>
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

                            <Text style={styles.dupTitle}>{t('suggestedPlants.alreadyAdded')}</Text>
                            <Text style={styles.dupText}>{t('suggestedPlants.plantAlreadyInList')}</Text>

                            <View style={styles.dupActions}>
                                <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setDupVisible(false)}>
                                    <Text style={styles.btnGhostText}>{t('suggestedPlants.close')}</Text>
                                </Pressable>

                                <Pressable
                                    style={[styles.btn, styles.btnPrimary]}
                                    onPress={() => {
                                        setDupVisible(false);
                                        router.replace(MY_PLANTS_ROUTE);
                                    }}
                                >
                                    <Text style={styles.btnPrimaryText}>{t('suggestedPlants.goToMyPlants')}</Text>
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

    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.94)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(45,106,79,0.18)",
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        color: "#1b4332",
        fontSize: 14,
        fontWeight: "600",
    },
    searchMeta: {
        marginBottom: 8,
        color: "#4a7856",
        fontSize: 12,
        fontWeight: "700",
    },
    locationBtn: {
        marginBottom: 12,
        backgroundColor: "#2d6a4f",
        borderRadius: 14,
        paddingVertical: 11,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    locationBtnText: {
        color: "#ffffff",
        fontSize: 13.5,
        fontWeight: "900",
    },

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
