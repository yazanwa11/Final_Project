import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem("access", data.access);
        await AsyncStorage.setItem("refresh", data.refresh);

        router.push("/(tabs)/HomeScreen");
      } else {
        showError("Incorrect username or password");
      }
    } catch (err) {
      showError("Network error. Try again.");
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
        {/* Logo */}
        <Image
          source={{ uri: "https://cdn-icons-png.flaticon.com/512/892/892926.png" }}
          style={styles.logo}
        />

        <Text style={styles.title}>Welcome Back 🌿</Text>
        <Text style={styles.subtitle}>Log in to care for your plants</Text>

        {/* Animated Error Box */}
        <Animated.View
          style={[
            styles.errorBox,
            {
              opacity: fadeAnim, transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                })
              }]
            }
          ]}
        >
          <Feather name="alert-circle" size={18} color="#fff" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </Animated.View>

        {/* Inputs */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#88a096"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
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
            <Text style={styles.buttonText}>Log In</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign Up */}
        <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
          <Text style={styles.link}>
            Don’t have an account? <Text style={styles.linkHighlight}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    alignItems: "center",
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1b4332",
  },
  subtitle: {
    fontSize: 16,
    color: "#4a7856",
    marginBottom: 30,
    fontStyle: "italic",
  },

  // ERROR BOX
  errorBox: {
    flexDirection: "row",
    backgroundColor: "#e63946",
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  errorText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "600",
    fontSize: 14,
  },

  // INPUTS
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffffdd",
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#cfe7d6",
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#333",
  },

  // BUTTON
  button: {
    width: "100%",
    borderRadius: 14,
    marginBottom: 15,
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },

  link: {
    marginTop: 10,
    fontSize: 15,
    color: "#4a7856",
  },
  linkHighlight: {
    fontWeight: "700",
    color: "#40916c",
  },
});
