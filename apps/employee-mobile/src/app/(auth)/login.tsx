import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { LoginScreen } from '@/screens/LoginScreen';

export default function LoginRoute() {
  const { session, employee, loading } = useAuth();

  if (!loading && session && employee) {
    return <Redirect href="/dashboard" />;
  }

  return <LoginScreen />;
}
