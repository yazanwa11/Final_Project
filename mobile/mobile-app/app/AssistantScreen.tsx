import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from 'react-i18next';
import { assistantChat } from "../services/assistantApi";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function AssistantScreen() {
  const { t, i18n } = useTranslation();
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    setBootLoading(false);
  }, []);

  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;

    const userMsg: ChatItem = {
      id: `${Date.now()}-u`,
      role: "user",
      content: message,
    };

    setItems((prev) => [...prev, userMsg]);
    setText("");
    setSending(true);

    try {
      const result = await assistantChat(message, sessionId);
      if (!sessionId && result.session_id) setSessionId(result.session_id);

      const assistantLines: string[] = [result.answer || ""];
      const follow = Array.isArray(result.follow_up_questions) ? result.follow_up_questions : [];
      if (follow.length) {
        assistantLines.push(`\n${t('assistant.followUpQuestions')}:`);
        follow.forEach((q: string) => assistantLines.push(`• ${q}`));
      }

      const assistantMsg: ChatItem = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: assistantLines.join("\n"),
      };

      setItems((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          role: "assistant",
          content: e?.message || t('assistant.error'),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (bootLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#f9faf9", "#e8f0eb", "#dae7df"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Feather name="message-circle" size={20} color="#2e4d35" />
              <Text style={styles.title}>{t('assistant.title')}</Text>
            </View>
            <Text style={styles.subtitle}>{t('assistant.subtitle')}</Text>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 14 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{t('assistant.emptyTitle')}</Text>
                <Text style={styles.emptyText}>{t('assistant.emptyText')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.bubbleText, item.role === "user" ? styles.userText : styles.assistantText]}>
                  {item.content}
                </Text>
              </View>
            )}
          />

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              style={styles.input}
              placeholder={t('assistant.placeholder')}
              placeholderTextColor="#7aa68a"
              multiline
            />
            <Pressable onPress={send} style={styles.sendBtn} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: "#1b4332", letterSpacing: -0.3 },
  subtitle: { marginTop: 8, color: "#52b788", fontSize: 14, fontWeight: "600" },

  empty: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#1b4332", marginBottom: 8 },
  emptyText: { marginTop: 4, color: "#5f9c6c", textAlign: "center", fontSize: 14, lineHeight: 20 },

  bubble: {
    borderRadius: 20,
    padding: 14,
    marginTop: 10,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2d6a4f",
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(82,183,136,0.2)",
    borderBottomLeftRadius: 6,
  },
  bubbleText: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
  userText: { color: "#ffffff" },
  assistantText: { color: "#1b4332" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 12,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "rgba(82,183,136,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#1b4332",
    fontSize: 16,
    fontWeight: "600",
  },
  sendBtn: {
    height: 52,
    width: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d6a4f",
    shadowColor: "#2d6a4f",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
