import * as Haptics from 'expo-haptics';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Feedback';
import { Field, PasswordInput } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';

export function ChangePasswordScreen() {
  const { session } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    setDone(false);

    if (!current) {
      setError('Enter your current password.');
      return;
    }
    if (next.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('Choose a password different from your current one.');
      return;
    }

    const email = session?.user.email;
    if (!email) {
      setError('Your session has expired. Sign in again.');
      return;
    }

    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        setError('Your current password is incorrect.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(friendlyError(updateError));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
        return;
      }

      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScreenHeader subtitle="Use at least 8 characters" title="Change password" />

      <Notice
        message="You will stay signed in on this device. If you forgot your password, use the reset link on the web login page instead."
        title="Password security"
        tone="indigo"
      />

      {done ? (
        <View style={styles.spaced}>
          <Notice
            message="Your new password is active. Use it the next time you sign in."
            title="Password updated"
            tone="success"
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.spaced}>
          <Notice message={error} title="Could not change password" tone="danger" />
        </View>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <ShieldCheck size={20} color={colors.indigoSoft} strokeWidth={1.9} />
          </View>
          <View style={styles.headerCopy}>
            <Text variant="subheading">Update your password</Text>
            <Text variant="small" color={colors.muted}>
              Enter your current password to confirm the change.
            </Text>
          </View>
        </View>

        <Field label="Current password" required>
          <PasswordInput
            autoCapitalize="none"
            leftIcon={Lock}
            onChangeText={setCurrent}
            placeholder="Current password"
            value={current}
          />
        </Field>

        <Field hint="At least 8 characters" label="New password" required>
          <PasswordInput
            autoCapitalize="none"
            leftIcon={Lock}
            onChangeText={setNext}
            placeholder="New password"
            value={next}
          />
        </Field>

        <Field label="Confirm new password" required>
          <PasswordInput
            autoCapitalize="none"
            leftIcon={Lock}
            onChangeText={setConfirm}
            placeholder="Repeat new password"
            value={confirm}
          />
        </Field>

        <Button label="Update password" loading={busy} onPress={() => void submit()} />
      </Card>

      <View style={styles.footer}>
        <Lock size={13} color={colors.muted} strokeWidth={1.9} />
        <Text variant="small" color={colors.muted}>
          Signed in as {session?.user.email ?? '—'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spaced: {
    marginTop: spacing.lg,
  },
  card: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.22)',
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
  },
});
