import * as Haptics from 'expo-haptics';
import {
  ArrowRight,
  Globe2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react-native';
import { useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { BrandLockup, BrandMark } from '@/components/brand/BrandMark';
import { Orb } from '@/components/orb/Orb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Notice } from '@/components/ui/Feedback';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useResponsive } from '@/lib/responsive';
import { openForgotPassword, openWebLogin } from '@/lib/web';

function signInMessage(raw: string): string {
  const message = raw.toLowerCase();
  if (message.includes('invalid login credentials')) {
    return 'Email or password is incorrect. If you were recently invited, use the password you set from the email link.';
  }
  if (message.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Open the invitation email and follow the link before signing in.';
  }
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Too many attempts. Wait a moment, then try again.';
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Could not reach VorldX. Check your connection and try again.';
  }
  return raw;
}

export function LoginScreen() {
  const { session, employee, accessError, error, signIn, signOut, refresh } = useAuth();
  const { isWide } = useResponsive();
  const reducedMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (session && !employee) {
    if (accessError) {
      return <AccessDenied message={accessError} email={session.user.email ?? ''} onSignOut={signOut} />;
    }
    if (error) {
      return (
        <AccessProblem
          message={error}
          onRetry={refresh}
          onSignOut={signOut}
        />
      );
    }
    return <LoadingScreen label="Checking your employee access" />;
  }

  const handleSignIn = async () => {
    if (busy) return;
    setFormError(null);

    if (!email.trim()) {
      setFormError('Enter your work email.');
      return;
    }
    if (!email.includes('@')) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setFormError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      const message = await signIn(email, password);
      if (message) {
        setFormError(signInMessage(message));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        void AccessibilityInfo.announceForAccessibility('Signed in');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} maxWidth={980}>
      <View style={styles.brandRow}>
        <BrandLockup compact />
        <Badge label="Employee app" tone="indigo" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <View style={[styles.main, isWide && styles.mainWide]}>
          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View
              pointerEvents="none"
              style={[styles.orbWrap, isWide ? styles.orbWrapWide : null]}>
              <Orb animated={!reducedMotion} intensity="normal" size={isWide ? 360 : 260} />
            </View>
            <View style={styles.heroCopy}>
              <Text variant="caption" color={colors.indigoSoft}>
                Employee attendance
              </Text>
              <Text variant="display" style={styles.headline}>
                Your workday,{'\n'}in one place.
              </Text>
              <Text variant="body" color={colors.textSecondary} style={styles.heroSub}>
                Scan in at the office, check in from home, and keep your attendance, leave,
                and WFH requests together.
              </Text>
            </View>
          </View>

          <Card style={[styles.card, isWide ? styles.cardWide : null]} padding={22}>
            <View style={styles.formHeader}>
              <Text variant="title">Welcome back</Text>
              <Text variant="small" color={colors.muted}>
                Sign in with your VorldX work email.
              </Text>
            </View>

            {formError ? (
              <Notice
                message={formError}
                tone="danger"
                title="Could not sign in"
                actionLabel={formError.toLowerCase().includes('not confirmed') ? 'Open web login' : undefined}
                onAction={
                  formError.toLowerCase().includes('not confirmed')
                    ? () => void openWebLogin()
                    : undefined
                }
              />
            ) : null}

            <View style={styles.fields}>
              <Field label="Work email" required>
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  leftIcon={Mail}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  returnKeyType="next"
                  textContentType="emailAddress"
                  value={email}
                />
              </Field>

              <Field label="Password" required>
                <Input
                  autoCapitalize="none"
                  autoComplete="password"
                  leftIcon={Lock}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void handleSignIn()}
                  placeholder="Your password"
                  returnKeyType="go"
                  secure
                  textContentType="password"
                  value={password}
                />
              </Field>

              <PressableScale
                accessibilityRole="button"
                haptic="selection"
                onPress={() => void openForgotPassword()}
                style={styles.forgot}>
                <Text variant="small" color={colors.indigoSoft} weight="medium">
                  Forgot password?
                </Text>
              </PressableScale>
            </View>

            <Button
              label={busy ? 'Signing in' : 'Sign in'}
              loading={busy}
              onPress={() => void handleSignIn()}
              rightIcon={busy ? undefined : <ArrowRight size={17} color={colors.white} strokeWidth={2.2} />}
            />

            <View style={styles.footer}>
              <View style={styles.divider} />
              <Text variant="caption" color={colors.muted} align="center" style={styles.footerNote}>
                Employees only · Admin & HR use the web dashboard
              </Text>
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>

      <View style={styles.legal}>
        <Text variant="small" color={colors.muted} align="center">
          Password setup and recovery open in the VorldX web app.
        </Text>
      </View>
    </Screen>
  );
}

function AccessDenied({
  message,
  email,
  onSignOut,
}: {
  message: string;
  email: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <Screen edges={['top', 'bottom']} contentContainerStyle={styles.accessContent} maxWidth={520}>
      <BrandLockup />
      <Card padding={24} style={styles.accessCard} tone="danger">
        <View style={styles.accessIcon}>
          <ShieldAlert size={28} color={colors.danger} strokeWidth={1.7} />
        </View>
        <Text variant="title" align="center">
          Employee access only
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {message}
        </Text>
        {email ? (
          <View style={styles.emailPill}>
            <Mail size={14} color={colors.muted} strokeWidth={1.8} />
            <Text variant="monoSmall" color={colors.textSecondary} numberOfLines={1}>
              {email}
            </Text>
          </View>
        ) : null}
        <Button
          label="Open web dashboard"
          onPress={() => void openWebLogin()}
          icon={<Globe2 size={17} color={colors.text} strokeWidth={1.9} />}
          variant="secondary"
          style={styles.accessButton}
        />
        <Button
          label="Sign out"
          onPress={() => void onSignOut()}
          icon={<LogOut size={16} color={colors.danger} strokeWidth={1.9} />}
          variant="ghost"
        />
      </Card>
      <Text variant="small" color={colors.muted} align="center">
        VorldX Attendance keeps employee and HR access separate.
      </Text>
    </Screen>
  );
}

function AccessProblem({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <Screen edges={['top', 'bottom']} contentContainerStyle={styles.accessContent} maxWidth={520}>
      <BrandMark size={56} />
      <Card padding={24} style={styles.accessCard}>
        <Text variant="title" align="center">
          Could not load your profile
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center">
          {message}
        </Text>
        <Button
          label="Try again"
          onPress={() => void onRetry()}
          icon={<RefreshCw size={15} color={colors.white} strokeWidth={2} />}
          style={styles.accessButton}
        />
        <Button label="Sign out" variant="ghost" onPress={() => void onSignOut()} />
      </Card>
      <Text variant="small" color={colors.muted} align="center">
        If this keeps happening, contact your HR or Admin.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  keyboard: {
    flex: 1,
  },
  main: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  mainWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxl,
    paddingTop: spacing.xxxl,
  },
  hero: {
    minHeight: 260,
    justifyContent: 'flex-end',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  heroWide: {
    flex: 1,
    minHeight: 460,
    paddingBottom: spacing.xxl,
  },
  orbWrap: {
    position: 'absolute',
    right: -68,
    top: -36,
    opacity: 0.94,
  },
  orbWrapWide: {
    right: -42,
    top: -10,
  },
  heroCopy: {
    maxWidth: 430,
    gap: spacing.sm,
  },
  headline: {
    marginTop: 2,
    maxWidth: 440,
  },
  heroSub: {
    maxWidth: 390,
    marginTop: 2,
  },
  card: {
    borderRadius: radii.xl,
  },
  cardWide: {
    width: 410,
  },
  formHeader: {
    gap: 4,
    marginBottom: spacing.xl,
  },
  fields: {
    gap: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  forgot: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    marginTop: -4,
  },
  footer: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  footerNote: {
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  legal: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  accessContent: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  accessCard: {
    alignItems: 'center',
    gap: spacing.md,
  },
  accessIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 131, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 131, 0.22)',
    marginBottom: spacing.xs,
  },
  emailPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  accessButton: {
    marginTop: spacing.sm,
  },
});
