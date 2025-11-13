import React from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#2E7D32",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          elevation: 15,
          height: 70,
          paddingBottom: 10,
          paddingTop: 5,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={["#ffffff", "#f6f9f6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="ExploreScreen"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <Feather name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="AddPlantScreen"
        options={{
          title: "Add",
          tabBarIcon: ({ color, size }) => (
            <Feather name="plus-circle" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="MyPlantsScreen"
        options={{
          title: "My Plants",
          tabBarIcon: ({ color, size }) => (
            <Feather name="droplet" size={size} color={color} />

          ),
        }}
      />
      <Tabs.Screen
        name="ProfileScreen"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
