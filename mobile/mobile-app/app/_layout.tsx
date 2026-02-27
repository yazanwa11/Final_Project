// app/_layout.tsx
import { Stack } from "expo-router";
import '../i18n/config'; // Initialize i18n

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />

      <Stack.Screen name="EditProfileScreen" />
      <Stack.Screen name="PlantDetailsScreen" />
      <Stack.Screen name="AssistantScreen" />

      {/* ✅ NEW */}
      <Stack.Screen name="NotificationsScreen" />
      <Stack.Screen name="ExpertInboxScreen" />
    </Stack>
  );
}
