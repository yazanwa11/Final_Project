import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Pressable,
  Linking,
  RefreshControl,
  I18nManager,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { getBestDeviceLocation } from "../services/locationService";
import { listNearbyNurseries, NearbyNursery } from "../services/nurseryApi";

const DEFAULT_LIMIT = 12;

export default function NurseriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [nurseries, setNurseries] = useState<NearbyNursery[]>([]);

  const loadData = useCallback(async (forceFreshLocation = false) => {
    try {
      setError(null);

      const location = await getBestDeviceLocation({ forceFresh: forceFreshLocation });
      if (!location) {
        throw new Error(t("nurseries.locationRequired"));
      }

      setLocationLabel(location.label || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);

      const payload = await listNearbyNurseries({
        latitude: location.latitude,
        longitude: location.longitude,
        limit: DEFAULT_LIMIT,
        keyword: "משתלה",
      });

      const sorted = [...(payload.results || [])].sort(
        (left, right) => Number(left.distance_km || 0) - Number(right.distance_km || 0)
      );

      setNurseries(sorted);
    } catch (err: any) {
      setNurseries([]);
      try {
        const parsed = JSON.parse(err?.message || "{}");
        if (parsed?.detail) {
          setError(String(parsed.detail));
          return;
        }
      } catch {
        // no-op
      }
      setError(err?.message || t("nurseries.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData(false);
      setLoading(false);
    })();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const openNavigation = useCallback(async (item: NearbyNursery) => {
    const navUrl = item.navigation_url || item.google_maps_url;
    if (!navUrl) return;

    const canOpen = await Linking.canOpenURL(navUrl);
    if (canOpen) {
      await Linking.openURL(navUrl);
      return;
    }

    if (item.google_maps_url) {
      await Linking.openURL(item.google_maps_url);
    }
  }, []);

  const callNumber = useCallback(async (phone?: string | null) => {
    if (!phone) {
      Alert.alert(t("nurseries.call"), t("nurseries.noPhone"));
      return;
    }

    const cleaned = phone.replace(/[^+\d]/g, "");
    const candidates = [`tel:${cleaned}`, `telprompt:${cleaned}`];

    for (const url of candidates) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // try next candidate
      }
    }

    Alert.alert(t("common.error"), t("nurseries.callUnavailable"));
  }, [t]);

  const headerSubtitle = useMemo(() => {
    if (locationLabel) {
      return t("nurseries.sortedByDistance", { location: locationLabel });
    }
    return t("nurseries.subtitle");
  }, [locationLabel, t]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loadingText}>{t("nurseries.loading")}</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#f9faf9", "#e8f0eb", "#dae7df"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Feather name={I18nManager.isRTL ? "arrow-right" : "arrow-left"} size={18} color="#1b4332" />
            </Pressable>

            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t("nurseries.title")}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>{headerSubtitle}</Text>
            </View>

            <Pressable onPress={onRefresh} style={styles.refreshBtn}>
              <Feather name="refresh-cw" size={17} color="#1b4332" />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.emptyWrap}>
              <Feather name="alert-circle" size={22} color="#b91c1c" />
              <Text style={styles.emptyTitle}>{t("nurseries.couldntLoad")}</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => loadData(true)}>
                <Text style={styles.retryText}>{t("nurseries.retry")}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={nurseries}
              keyExtractor={(item) => item.place_id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 14, paddingBottom: 22, gap: 12 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d6a4f" />}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Feather name="map-pin" size={22} color="#2d6a4f" />
                  <Text style={styles.emptyTitle}>{t("nurseries.emptyTitle")}</Text>
                  <Text style={styles.emptyText}>{t("nurseries.emptyText")}</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.distancePill}>
                      <Feather name="navigation" size={13} color="#1b4332" />
                      <Text style={styles.distanceText}>{t("nurseries.distanceKm", { km: item.distance_km })}</Text>
                    </View>
                  </View>

                  <Text style={styles.address} numberOfLines={2}>{item.address || t("nurseries.addressUnavailable")}</Text>

                  <View style={styles.metaRow}>
                    <Feather name="phone" size={14} color="#2d6a4f" />
                    <Text style={styles.metaText}>{item.phone_number || t("nurseries.noPhone")}</Text>
                  </View>

                  {typeof item.rating === "number" ? (
                    <View style={styles.metaRow}>
                      <Feather name="star" size={14} color="#2d6a4f" />
                      <Text style={styles.metaText}>
                        {t("nurseries.rating", {
                          rating: item.rating.toFixed(1),
                          count: item.user_ratings_total ?? 0,
                        })}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <Pressable style={styles.primaryBtn} onPress={() => openNavigation(item)}>
                      <Feather name="map" size={15} color="#fff" />
                      <Text style={styles.primaryText}>{t("nurseries.navigate")}</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.secondaryBtn, !item.phone_number && styles.secondaryBtnDisabled]}
                      onPress={() => callNumber(item.phone_number)}
                      disabled={!item.phone_number}
                    >
                      <Feather name="phone-call" size={15} color="#1b4332" />
                      <Text style={styles.secondaryText}>{t("nurseries.call")}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#2d6a4f", fontSize: 16, fontWeight: "800" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: { flex: 1, paddingHorizontal: 8 },
  title: { fontSize: 26, fontWeight: "900", color: "#1b4332", letterSpacing: -0.4 },
  subtitle: { marginTop: 4, fontSize: 14, color: "#52b788", fontWeight: "700" },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.4)",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.4)",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212,241,223,0.3)",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: "900", color: "#1b4332", letterSpacing: -0.2 },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(82,183,136,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { color: "#1b4332", fontWeight: "800", fontSize: 12 },
  address: { marginTop: 9, color: "#2d6a4f", fontSize: 14, lineHeight: 20, fontWeight: "500" },

  metaRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { color: "#1b4332", fontSize: 14, fontWeight: "700", flex: 1 },

  actionsRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2d6a4f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(212,241,223,0.5)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnDisabled: { opacity: 0.45 },
  secondaryText: { color: "#1b4332", fontSize: 15, fontWeight: "900" },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "900", color: "#1b4332", textAlign: "center" },
  emptyText: { marginTop: 8, fontSize: 15, color: "#52b788", textAlign: "center", lineHeight: 22 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#2d6a4f",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
