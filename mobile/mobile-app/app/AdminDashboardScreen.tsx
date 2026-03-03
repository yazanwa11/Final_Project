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
    const experts = users.filter((u) => u.role === "expert").length;
    const active = users.filter((u) => u.is_active).length;
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
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loaderText}>Loading admin dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} />}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        <LinearGradient colors={["#1b4332", "#2d6a4f"]} style={styles.hero}>
          <View>
            <Text style={styles.heroTitle}>Admin Dashboard</Text>
            <Text style={styles.heroSubtitle}>Manage users and expert approvals</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Feather name="log-out" size={18} color="#1b4332" />
            <Text style={styles.logoutTxt}>Logout</Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatCard label="Users" value={stats.total} icon="users" />
          <StatCard label="Experts" value={stats.experts} icon="award" />
          <StatCard label="Pending" value={stats.pending} icon="clock" />
          <StatCard label="Active" value={stats.active} icon="check-circle" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Expert Requests</Text>
          {pendingExperts.length === 0 ? (
            <Text style={styles.emptyText}>No pending experts right now.</Text>
          ) : (
            pendingExperts.map((user) => (
              <View key={user.id} style={styles.pendingCard}>
                <View>
                  <Text style={styles.cardName}>{user.username}</Text>
                  <Text style={styles.cardSub}>{user.email || "No email"}</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => onApproveReject(user.id, "approve")}
                    style={[styles.approvalBtn, styles.approveBtn]}
                  >
                    <Text style={styles.approvalTxt}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={() => onApproveReject(user.id, "reject")}
                    style={[styles.approvalBtn, styles.rejectBtn]}
                  >
                    <Text style={styles.approvalTxt}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Users</Text>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{user.username}</Text>
                <Text style={styles.cardSub}>{user.email || "No email"}</Text>
                <View style={styles.chipsRow}>
                  <RoleChip role={user.role} />
                  <StatusChip active={user.is_active} />
                  {user.role === "expert" ? <ApprovalChip status={user.expert_approval_status} /> : null}
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
                >
                  <Feather name="edit-2" size={16} color="#1b4332" />
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={saving}
                  onPress={() => onDeleteUser(user.id, user.username)}
                  style={[styles.iconBtn, { backgroundColor: "#fde8e8" }]}
                >
                  <Feather name="trash-2" size={16} color="#c0392b" />
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
                const active = editingUser?.role === role;
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setEditingUser((prev) => (prev ? { ...prev, role } : prev))}
                    style={[styles.roleBtn, active && styles.roleBtnActive]}
                  >
                    <Text style={[styles.roleBtnText, active && styles.roleBtnTextActive]}>{role}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setEditingUser((prev) => (prev ? { ...prev, is_active: !prev.is_active } : prev))}
              style={[styles.activeToggle, editingUser?.is_active ? styles.activeOn : styles.activeOff]}
            >
              <Text style={styles.activeTxt}>{editingUser?.is_active ? "Account Active" : "Account Disabled"}</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditingUser(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={onSaveEdit} style={styles.modalSave}>
                <Text style={styles.modalSaveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon} size={16} color="#2d6a4f" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RoleChip({ role }: { role: "admin" | "expert" | "user" }) {
  const map = {
    admin: { bg: "#ddeeff", txt: "#1f5ea8" },
    expert: { bg: "#e8f7e9", txt: "#2e7d32" },
    user: { bg: "#f1f3f5", txt: "#4b5563" },
  };
  return (
    <View style={[styles.chip, { backgroundColor: map[role].bg }]}>
      <Text style={[styles.chipTxt, { color: map[role].txt }]}>{role}</Text>
    </View>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: active ? "#e8f7e9" : "#fde8e8" }]}>
      <Text style={[styles.chipTxt, { color: active ? "#2e7d32" : "#c0392b" }]}>{active ? "active" : "disabled"}</Text>
    </View>
  );
}

function ApprovalChip({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: { bg: "#fff7db", txt: "#9a7d0a" },
    approved: { bg: "#e8f7e9", txt: "#2e7d32" },
    rejected: { bg: "#fde8e8", txt: "#c0392b" },
  };
  return (
    <View style={[styles.chip, { backgroundColor: map[status].bg }]}>
      <Text style={[styles.chipTxt, { color: map[status].txt }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f8f5" },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f8f5" },
  loaderText: { marginTop: 10, color: "#2d6a4f", fontWeight: "600" },

  hero: {
    margin: 16,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroSubtitle: { color: "#dff3e8", marginTop: 4, fontSize: 13 },
  logoutBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutTxt: { color: "#1b4332", fontWeight: "700" },

  statsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  statCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e0eee5",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statValue: { color: "#1b4332", fontSize: 20, fontWeight: "800", marginTop: 6 },
  statLabel: { color: "#5b7b6a", marginTop: 2, fontWeight: "600" },

  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1f3b2e", marginBottom: 10 },
  emptyText: { color: "#6e8b7b", fontWeight: "600", backgroundColor: "#fff", borderRadius: 12, padding: 12 },

  pendingCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0eee5",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingActions: { flexDirection: "row", gap: 8 },
  approvalBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  approveBtn: { backgroundColor: "#2d6a4f" },
  rejectBtn: { backgroundColor: "#b02a37" },
  approvalTxt: { color: "#fff", fontWeight: "700" },

  userCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0eee5",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  cardName: { fontSize: 16, fontWeight: "800", color: "#1f3b2e" },
  cardSub: { color: "#6e8b7b", marginTop: 2 },
  chipsRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  chipTxt: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },

  userActions: { marginLeft: 10, gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#edf7f0",
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1f3b2e", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d4e8da",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1f3b2e",
    marginBottom: 10,
    backgroundColor: "#f7fcf9",
  },
  rolesWrap: { flexDirection: "row", gap: 8, marginVertical: 6 },
  roleBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d4e8da",
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#f7fcf9",
  },
  roleBtnActive: {
    backgroundColor: "#2d6a4f",
    borderColor: "#2d6a4f",
  },
  roleBtnText: { color: "#2d6a4f", fontWeight: "700", textTransform: "capitalize" },
  roleBtnTextActive: { color: "#fff" },
  activeToggle: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 8,
  },
  activeOn: { backgroundColor: "#e8f7e9" },
  activeOff: { backgroundColor: "#fde8e8" },
  activeTxt: { color: "#1f3b2e", fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d4e8da",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
  },
  modalCancelTxt: { color: "#3f6b50", fontWeight: "700" },
  modalSave: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#2d6a4f",
    alignItems: "center",
    paddingVertical: 11,
  },
  modalSaveTxt: { color: "#fff", fontWeight: "700" },
});
