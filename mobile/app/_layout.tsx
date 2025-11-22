import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>

        {/* MAIN TABS */}
        <Stack.Screen name="(tabs)" />

        {/* AUTH */}
        <Stack.Screen name="(auth)/signup" />

        {/* STANDALONE SCREENS */}
        <Stack.Screen name="EditProfileScreen" />
        <Stack.Screen name="PlantDetailsScreen" />

        {/* MODAL */}
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', headerShown: true, title: 'Modal' }}
        />

      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
