import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from 'react-i18next';
import { loginStyles as styles } from "../styles/login.styles";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "expert" | "user">("user");
  const [errorMsg, setErrorMsg] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const showError = (msg: string) => {
    setErrorMsg(msg);

    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 2500);
  };

  const handleLogin = async () => {
    try {
      const response = await fetch("http://10.0.2.2:8000/api/users/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role: selectedRole }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem("access", data.access);
        await AsyncStorage.setItem("refresh", data.refresh);
        await AsyncStorage.setItem("role", data.role || selectedRole);

        if ((data.role || selectedRole) === "admin") {
          router.push("/(tabs)/AdminDashboardScreen");
        } else {
          router.push("/(tabs)/HomeScreen");
        }
      } else {
        showError(
          data?.detail
            || data?.role?.[0]
            || data?.non_field_errors?.[0]
            || t('auth.incorrectCredentials')
        );
      }
    } catch {
      showError(t('auth.networkErrorLogin'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#d8f3dc", "#f6fff8"]}
        style={styles.container}
      >
        {/* BIGGER / CLEANER LOGO */}
        <Image
          source={{
            uri: "https://cdn-icons-png.flaticon.com/128/6670/6670681.png",
          }}
          style={styles.logo}
        />


        <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

        <View style={{ width: "88%", marginBottom: 14 }}>
          <Text style={{ color: "#1f3b2e", fontWeight: "700", marginBottom: 8 }}>Login as</Text>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#f0f7f2",
              borderRadius: 14,
              padding: 4,
              borderWidth: 1,
              borderColor: "#d3ead8",
            }}
          >
            {(["admin", "expert", "user"] as const).map((role) => {
              const active = selectedRole === role;
              return (
                <TouchableOpacity
                  key={role}
                  onPress={() => setSelectedRole(role)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 10,
                    backgroundColor: active ? "#52b788" : "transparent",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: active ? "#fff" : "#3f6b50", fontWeight: "700", textTransform: "capitalize" }}>
                    {role}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Animated Error Box */}
        {errorMsg !== "" && (
          <Animated.View
            style={[
              styles.errorBox,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Feather name="alert-circle" size={18} color="#fff" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </Animated.View>
        )}

        {/* Inputs */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.username')}
              placeholderTextColor="#88a096"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder={t('auth.password')}
              placeholderTextColor="#88a096"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <LinearGradient
            colors={["#74c69d", "#52b788"]}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>{t('auth.logIn')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign Up */}
        <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
          <Text style={styles.link}>
            {t('auth.dontHaveAccount')}{" "}
            <Text style={styles.linkHighlight}>{t('auth.signUp')}</Text>
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
