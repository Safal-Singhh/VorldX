import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { session, employee, accessError, error, loading } = useAuth();

  // Wait for the stored session and profile before redirecting, so a fresh
  // launch or deep link keeps its intended route instead of bouncing to login.
  if (loading) {
    return <LoadingScreen label="Loading your workspace" />;
  }

  if (!session || !employee || accessError || error) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="policies" />
      <Stack.Screen name="change-password" />
    </Stack>
  );
}
