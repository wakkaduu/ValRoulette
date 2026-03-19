import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F1923' },
      }}
    >
      {/* This forces the app to only show the Roulette screen */}
      <Stack.Screen name="index" options={{ title: 'VALORANT ROULETTE' }} />
    </Stack>
  );
}