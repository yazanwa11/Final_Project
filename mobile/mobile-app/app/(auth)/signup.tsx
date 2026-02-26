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
import { signupStyles as styles } from "../styles/signup.styles";

export default function SignupScreen() {
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
      alert("Passwords do not match!");
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
        alert("Signup failed");
      }
    } catch {
      alert("Something went wrong!");
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

        <Text style={styles.title}>Create Account 🌱</Text>
        <Text style={styles.subtitle}>Sign up to start your journey</Text>

        {/* INPUTS */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Feather name="user" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#88a096"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Feather name="mail" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#88a096"
              value={email}
              onChangeText={setEmail}
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

          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color="#4a7856" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
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
            <Text style={styles.buttonText}>Sign Up</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* LOGIN LINK */}
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.link}>
            Already have an account?{" "}
            <Text style={styles.linkHighlight}>Log in</Text>
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
              <Text style={styles.modalTitle}>Welcome to GreenBuddy 🌿</Text>
              <Text style={styles.modalMessage}>
                Your account has been created successfully.
              </Text>

              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setSuccessVisible(false);
                  router.push("/");
                }}
              >
                <Text style={styles.modalButtonText}>Continue</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
