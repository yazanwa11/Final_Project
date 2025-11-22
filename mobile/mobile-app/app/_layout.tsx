// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      
      {/* Login Screen */}
      <Stack.Screen name="index" />

      {/* Auth folder → signup */}
      <Stack.Screen name="(auth)" />

      {/* Tabs after login */}
      <Stack.Screen name="(tabs)" />

      {/* Screens outside tabs */}
      <Stack.Screen name="EditProfileScreen" />
      <Stack.Screen name="PlantDetailsScreen" />
    </Stack>
  );
}
