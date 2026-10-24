import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, employee, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Loading your workspace" />;
  }

  if (session && employee) return <Redirect href="/dashboard" />;
  return <Redirect href="/login" />;
}
