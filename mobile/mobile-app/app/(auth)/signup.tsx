import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { signupStyles as styles } from "../styles/signup.styles";

export default function SignupScreen() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [successVisible, setSuccessVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const showSuccess = () => {
    setSuccessVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      alert(t("auth.passwordsNotMatch"));
      return;
    }

    try {
      const response = await fetch("http://10.0.2.2:8000/api/users/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          email,
          password,
        }),
      });

      if (response.ok) {
        showSuccess();
      } else {
        alert(t("auth.signupFailed"));
      }
    } catch {
      alert(t("auth.somethingWentWrong"));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* SAME BACKGROUND AS LOGIN */}
      <LinearGradient
        colors={["#d8f3dc", "#f6fff8"]}
        style={styles.container}
      >
        {/* LOGO */}
        <Image
          source={{ uri: "https://cdn-icons-png.flaticon.com/128/6670/6670681.png" }}
          style={styles.logo}
        />

        <Text style={styles.title}>{t("auth.createAccount")} 🌱</Text>
        <Text style={styles.subtitle}>{t("auth.signupSubtitle")}</Text>

        {/* INPUTS */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.username")}
              placeholderTextColor="#88a096"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="mail" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.emailAddress")}
              placeholderTextColor="#88a096"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.password")}
              placeholderTextColor="#88a096"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t("auth.confirmPassword")}
              placeholderTextColor="#88a096"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
        </View>

        {/* SIGN UP BUTTON */}
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <LinearGradient
            colors={["#74c69d", "#52b788"]}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>{t("auth.signup")}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* LOGIN LINK */}
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.link}>
            {t("auth.alreadyHaveAccount")}{" "}
            <Text style={styles.linkHighlight}>{t("auth.logIn")}</Text>
          </Text>
        </TouchableOpacity>

        {/* SUCCESS MODAL */}
        <Modal transparent visible={successVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <Animated.View
              style={[
                styles.modalCard,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Feather name="check-circle" size={60} color="#4CAF50" />
              <Text style={styles.modalTitle}>{t("auth.welcomeToGreenBuddy")} 🌿</Text>
              <Text style={styles.modalMessage}>
                {t("auth.accountCreatedSuccess")}
              </Text>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setSuccessVisible(false);
                  router.push("/");
                }}
              >
                <Text style={styles.modalButtonText}>{t("auth.continue")}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
