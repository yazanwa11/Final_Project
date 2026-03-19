import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AdminUser,
  deleteAdminUser,
  listAdminUsers,
  listPendingExperts,
  reviewExpert,
  updateAdminUser,
} from "../services/adminApi";

type EditableUser = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "expert" | "user";
  is_active: boolean;
};

export default function AdminDashboardScreen() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingExperts, setPendingExperts] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [usersResult, pendingResult] = await Promise.all([
        listAdminUsers(),
        listPendingExperts(),
      ]);

      setUsers(usersResult);
      setPendingExperts(pendingResult);
    } catch {
      Alert.alert("Error", "Failed to load admin dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const total = users.length;
    const experts = users.filter((user) => user.role === "expert").length;
    const active = users.filter((user) => user.is_active).length;
    return { total, experts, pending: pendingExperts.length, active };
  }, [users, pendingExperts]);

  const onApproveReject = async (userId: number, action: "approve" | "reject") => {
    try {
      setSaving(true);
      await reviewExpert(userId, action);
      await loadDashboard(true);
    } catch {
      Alert.alert("Error", "Failed to update expert approval status.");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteUser = (userId: number, username: string) => {
    Alert.alert("Delete user", `Delete account ${username}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            await deleteAdminUser(userId);
            await loadDashboard(true);
          } catch {
            Alert.alert("Error", "Failed to delete user.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const onSaveEdit = async () => {
    if (!editingUser) return;

    try {
      setSaving(true);
      await updateAdminUser(editingUser.id, {
        username: editingUser.username,
        email: editingUser.email,
        role: editingUser.role,
        is_active: editingUser.is_active,
      });
      setEditingUser(null);
      await loadDashboard(true);
    } catch {
      Alert.alert("Error", "Failed to save user changes.");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await AsyncStorage.multiRemove(["access", "refresh", "role"]);
    router.replace("/");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#3d7a5f" />
          <Text style={styles.loaderText}>Loading admin dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} tintColor="#3d7a5f" />}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient colors={["#123b2a", "#2d6a4f", "#4f9d7a"]} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Feather name="shield" size={14} color="#e8ffef" />
              <Text style={styles.heroBadgeText}>Admin Center</Text>
            </View>
            <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.9}>
              <Feather name="log-out" size={16} color="#173f30" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>Dashboard</Text>
          <Text style={styles.heroSubtitle}>User management and expert approval workflow</Text>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatCard label="Users" value={stats.total} icon="users" />
          <StatCard label="Experts" value={stats.experts} icon="award" />
          <StatCard label="Pending" value={stats.pending} icon="clock" />
          <StatCard label="Active" value={stats.active} icon="check-circle" />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Expert Requests</Text>
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{pendingExperts.length}</Text>
            </View>
          </View>

          {pendingExperts.length === 0 ? (
            <View style={styles.emptyStateWrap}>
              <Feather name="check-circle" size={16} color="#2d6a4f" />
              <Text style={styles.emptyStateText}>All requests are handled.</Text>
            </View>
          ) : (
            pendingExperts.map((user) => (
              <View key={user.id} style={styles.pendingCard}>
                <View style={styles.cardMainInfo}>
                  <Text style={styles.cardName}>{user.username}</Text>
                  <Text style={styles.cardSub}>{user.email || "No email"}</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => onApproveReject(user.id, "approve")}
                    style={[styles.actionBtn, styles.approveBtn]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => onApproveReject(user.id, "reject")}
                    style={[styles.actionBtn, styles.rejectBtn]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Users</Text>
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{users.length}</Text>
            </View>
          </View>

          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userIdentityWrap}>
                <View style={styles.avatarBubble}>
                  <Feather name="user" size={15} color="#2d6a4f" />
                </View>
                <View style={styles.cardMainInfo}>
                  <Text style={styles.cardName}>{user.username}</Text>
                  <Text style={styles.cardSub}>{user.email || "No email"}</Text>
                  <View style={styles.chipsRow}>
                    <RoleChip role={user.role} />
                    <StatusChip active={user.is_active} />
                    {user.role === "expert" ? <ApprovalChip status={user.expert_approval_status} /> : null}
                  </View>
                </View>
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity
                  disabled={saving}
                  onPress={() =>
                    setEditingUser({
                      id: user.id,
                      username: user.username,
                      email: user.email || "",
                      role: user.role,
                      is_active: user.is_active,
                    })
                  }
                  style={styles.iconBtn}
                  activeOpacity={0.9}
                >
                  <Feather name="edit-2" size={15} color="#1f4f3d" />
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={saving}
                  onPress={() => onDeleteUser(user.id, user.username)}
                  style={[styles.iconBtn, styles.deleteIconBtn]}
                  activeOpacity={0.9}
                >
                  <Feather name="trash-2" size={15} color="#b1303b" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal transparent visible={!!editingUser} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit User</Text>

            <TextInput
              value={editingUser?.username || ""}
              onChangeText={(text) => setEditingUser((prev) => (prev ? { ...prev, username: text } : prev))}
              placeholder="Username"
              style={styles.input}
              placeholderTextColor="#8aa696"
            />

            <TextInput
              value={editingUser?.email || ""}
              onChangeText={(text) => setEditingUser((prev) => (prev ? { ...prev, email: text } : prev))}
              placeholder="Email"
              style={styles.input}
              placeholderTextColor="#8aa696"
            />

            <View style={styles.rolesWrap}>
              {(["admin", "expert", "user"] as const).map((role) => {
                const activeRole = editingUser?.role === role;
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setEditingUser((prev) => (prev ? { ...prev, role } : prev))}
                    style={[styles.roleBtn, activeRole && styles.roleBtnActive]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.roleBtnText, activeRole && styles.roleBtnTextActive]}>{role}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setEditingUser((prev) => (prev ? { ...prev, is_active: !prev.is_active } : prev))}
              style={[styles.activeToggle, editingUser?.is_active ? styles.activeOn : styles.activeOff]}
              activeOpacity={0.9}
            >
              <Text style={styles.activeText}>{editingUser?.is_active ? "Account Active" : "Account Disabled"}</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditingUser(null)} style={styles.modalCancel} activeOpacity={0.9}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={onSaveEdit} style={styles.modalSave} activeOpacity={0.9}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Feather name={icon} size={16} color="#2d6a4f" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RoleChip({ role }: { role: "admin" | "expert" | "user" }) {
  const map = {
    admin: { bg: "#deebff", txt: "#2f5cab" },
    expert: { bg: "#ddf6e6", txt: "#1f7a42" },
    user: { bg: "#eceff3", txt: "#516173" },
  };

  return (
    <View style={[styles.chip, { backgroundColor: map[role].bg }]}>
      <Text style={[styles.chipText, { color: map[role].txt }]}>{role}</Text>
    </View>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: active ? "#ddf6e6" : "#ffe4e4" }]}>
      <Text style={[styles.chipText, { color: active ? "#1f7a42" : "#b1303b" }]}>{active ? "active" : "disabled"}</Text>
    </View>
  );
}

function ApprovalChip({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: { bg: "#fff2cf", txt: "#9e7507" },
    approved: { bg: "#ddf6e6", txt: "#1f7a42" },
    rejected: { bg: "#ffe4e4", txt: "#b1303b" },
  };

  return (
    <View style={[styles.chip, { backgroundColor: map[status].bg }]}>
      <Text style={[styles.chipText, { color: map[status].txt }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef5f0",
  },
  container: {
    flex: 1,
    backgroundColor: "#eef5f0",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    gap: 14,
  },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef5f0",
  },
  loaderText: {
    marginTop: 10,
    color: "#2d6a4f",
    fontWeight: "700",
  },

  heroCard: {
    borderRadius: 24,
    padding: 18,
    shadowColor: "#0d2c1f",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  heroBadgeText: {
    color: "#ecfff4",
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 14,
    color: "#f5fff9",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    marginTop: 4,
    color: "#d6f2e3",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutBtn: {
    backgroundColor: "#f5fff9",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: "#173f30",
    fontWeight: "700",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  statCard: {
    width: "48.5%",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfebe4",
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#e8f5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    marginTop: 8,
    fontSize: 22,
    color: "#193a2d",
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 2,
    color: "#628473",
    fontWeight: "600",
  },

  sectionCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfebe4",
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#173f30",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionCountPill: {
    minWidth: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ecf7f1",
  },
  sectionCountText: {
    color: "#2d6a4f",
    fontWeight: "800",
    fontSize: 12,
  },
  emptyStateWrap: {
    borderRadius: 13,
    backgroundColor: "#f4fcf7",
    borderWidth: 1,
    borderColor: "#dcf1e4",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyStateText: {
    color: "#336b53",
    fontWeight: "700",
  },

  pendingCard: {
    borderRadius: 14,
    backgroundColor: "#f9fcfa",
    borderWidth: 1,
    borderColor: "#e3efe8",
    padding: 12,
    marginBottom: 10,
  },
  cardMainInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    color: "#1a402f",
    fontWeight: "800",
  },
  cardSub: {
    marginTop: 3,
    color: "#668874",
    fontWeight: "500",
  },
  pendingActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  approveBtn: {
    backgroundColor: "#2d6a4f",
  },
  rejectBtn: {
    backgroundColor: "#b1303b",
  },
  actionBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  userCard: {
    borderRadius: 14,
    backgroundColor: "#f9fcfa",
    borderWidth: 1,
    borderColor: "#e3efe8",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  userIdentityWrap: {
    flexDirection: "row",
    flex: 1,
    gap: 10,
  },
  avatarBubble: {
    marginTop: 2,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#e8f5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  userActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#e9f6ef",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIconBtn: {
    backgroundColor: "#ffe8ea",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(8, 20, 14, 0.42)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dceae2",
    padding: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#173f30",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d2e6da",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#173f30",
    marginBottom: 10,
    backgroundColor: "#f7fcf9",
  },
  rolesWrap: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 6,
  },
  roleBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d2e6da",
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#f7fcf9",
  },
  roleBtnActive: {
    backgroundColor: "#2d6a4f",
    borderColor: "#2d6a4f",
  },
  roleBtnText: {
    color: "#2d6a4f",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  roleBtnTextActive: {
    color: "#ffffff",
  },
  activeToggle: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 8,
  },
  activeOn: {
    backgroundColor: "#ddf6e6",
  },
  activeOff: {
    backgroundColor: "#ffe4e4",
  },
  activeText: {
    color: "#173f30",
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d2e6da",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
  },
  modalCancelText: {
    color: "#3f6b50",
    fontWeight: "700",
  },
  modalSave: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    paddingVertical: 11,
  },
  modalSaveText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
