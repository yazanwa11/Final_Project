// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />       {/* Login */}
      <Stack.Screen name="(auth)" />      {/* Signup */}
      <Stack.Screen name="(tabs)" />      {/* Tabs after login */}
    </Stack>
  );
}
