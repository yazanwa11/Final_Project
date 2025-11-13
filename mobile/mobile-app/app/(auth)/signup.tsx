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
  Modal,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [successVisible, setSuccessVisible] = useState(false);

  // Animation
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

      const text = await response.text();
      console.log("Signup raw response:", text);

      if (response.ok) {
        showSuccess();
      } else {
        alert("Signup failed: " + text);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong!");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Logo */}
        <Image
          source={{ uri: "https://cdn-icons-png.flaticon.com/512/892/892926.png" }}
          style={styles.logo}
        />

        {/* Title */}
        <Text style={styles.title}>Create Account 🌱</Text>
        <Text style={styles.subtitle}>Sign up to start your journey</Text>

        {/* Inputs */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </View>

        {/* Signup Button */}
        <TouchableOpacity style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>

        {/* Login Redirect */}
        <TouchableOpacity onPress={() => router.push("/")}>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </TouchableOpacity>

        {/* SUCCESS POPUP */}
        <Modal transparent visible={successVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <Animated.View
              style={[
                styles.modalCard,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Feather name="check-circle" size={60} color="#4CAF50" />
              <Text style={styles.modalTitle}>Welcome to GreenBuddy! 🌿</Text>
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
      </View>
    </KeyboardAvoidingView>
  );
}

// -------------------- STYLES --------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfd",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 30,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 16,
  },
  button: {
    width: "100%",
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  link: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 15,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginTop: 15,
  },
  modalMessage: {
    fontSize: 15,
    textAlign: "center",
    color: "#555",
    marginVertical: 10,
  },
  modalButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 10,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
