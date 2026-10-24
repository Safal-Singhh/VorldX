import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useIsFocused, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Home,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Settings,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, tones, type Tone } from '@/constants/theme';
import { useRecentAttendance } from '@/hooks/use-data';
import { markOfficeAttendance } from '@/lib/api';
import { todayRecord } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { DEFAULT_TIMEZONE, formatTime } from '@/lib/dates';
import { errorCode, friendlyError } from '@/lib/errors';
import type { OfficeAttendanceResult } from '@/lib/types';

type ScanResult = {
  tone: Tone;
  title: string;
  message: string;
  record?: OfficeAttendanceResult;
};

export function ScanScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const { company } = useAuth();
  const timezone = company?.timezone ?? DEFAULT_TIMEZONE;
  const [permission, requestPermission] = useCameraPermissions();
  const attendanceQuery = useRecentAttendance(90);
  const [torch, setTorch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const record = todayRecord(attendanceQuery.data ?? [], timezone);
  const isAbsent = record?.status === 'absent';

  const refresh = async () => {
    setRefreshing(true);
    try {
      await attendanceQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      if (inFlight.current || paused || !data.trim()) return;
      if (isAbsent) {
        setResult({
          tone: 'danger',
          title: 'Attendance closed',
          message:
            'Today is marked absent because no check-in was recorded before shift end. Ask HR or Admin to correct it if you were present.',
        });
        return;
      }
      inFlight.current = true;
      setPaused(true);
      setScanning(true);
      setResult(null);
      setCameraError(null);

      try {
        const scanned = await markOfficeAttendance(data.trim());
        const checkedOut =
          scanned.check_out_at &&
          Math.abs(Date.now() - new Date(scanned.check_out_at).getTime()) < 60_000;

        setResult({
          tone: 'success',
          title: checkedOut ? 'Checked out' : 'Checked in',
          message: checkedOut
            ? `Your day is complete. Checked in at ${formatTime(
                scanned.check_in_at,
                timezone,
              )} and out at ${formatTime(scanned.check_out_at, timezone)}.`
            : `Attendance recorded at ${formatTime(scanned.check_in_at, timezone)}. Scan again when you leave to check out.`,
          record: scanned,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['attendance-recent'] }),
          queryClient.invalidateQueries({ queryKey: ['attendance-month'] }),
        ]);
      } catch (scanError) {
        const code = errorCode(scanError);
        setResult({
          tone: 'danger',
          title: code === 'QR_EXPIRED' ? 'QR code expired' : 'Could not record attendance',
          message: friendlyError(scanError),
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
      } finally {
        inFlight.current = false;
        setScanning(false);
      }
    },
    [isAbsent, paused, queryClient, timezone],
  );

  const scanAgain = () => {
    setResult(null);
    setPaused(false);
    setCameraError(null);
  };

  const latestType = result?.record?.type ?? record?.attendance_type ?? null;
  const latestCheckIn = result?.record?.check_in_at ?? record?.check_in_at ?? null;
  const latestCheckOut = result?.record?.check_out_at ?? record?.check_out_at ?? null;
  const hasLatest = Boolean(latestType && latestCheckIn);
  const cameraAllowed = Device.isDevice;
  const torchOn = focused && torch;

  return (
    <Screen contentContainerStyle={styles.screenContent} scroll={false}>
      <PageHeader
        compact
        eyebrow="Office attendance"
        subtitle="Point your camera at the VorldX display. The code refreshes every 18 seconds."
        title="Scan to check in"
        right={
          <Button
            fullWidth={false}
            icon={
              <RefreshCw
                size={13}
                color={colors.text}
                strokeWidth={2}
              />
            }
            label="Refresh"
            loading={refreshing}
            onPress={() => void refresh()}
            size="sm"
            variant="secondary"
          />
        }
      />

      <View style={styles.statusRow}>
        {isAbsent ? (
          <>
            <Badge label="Absent" tone="danger" dot />
            <Text variant="small" color={colors.textSecondary} style={styles.statusText}>
              No check-in by shift end. Ask HR or Admin to correct it if you were present.
            </Text>
          </>
        ) : hasLatest ? (
          <>
            <Badge
              label={latestType === 'wfh' ? 'WFH' : 'Office'}
              tone={latestType === 'wfh' ? 'info' : 'success'}
              dot
            />
            <Text variant="small" color={colors.textSecondary} style={styles.statusText}>
              {latestCheckOut
                ? `Day complete · ${formatTime(latestCheckIn as string, timezone)} – ${formatTime(
                    latestCheckOut,
                    timezone,
                  )}`
                : `Checked in at ${formatTime(latestCheckIn as string, timezone)} · Scan again to check out`}
            </Text>
          </>
        ) : (
          <>
            <Badge label="Not checked in" tone="neutral" dot />
            <Text variant="small" color={colors.muted} style={styles.statusText}>
              No office attendance recorded for today.
            </Text>
          </>
        )}
      </View>

      <View style={styles.cameraCard}>
        {!cameraAllowed ? (
          <CameraUnavailable
            message="Camera scanning needs a physical phone. The iOS simulator does not include a camera, so test this flow on the Android device."
            onWfh={() => router.navigate('/wfh')}
          />
        ) : !permission ? (
          <View style={styles.permissionState}>
            <ActivityIndicator color={colors.indigoSoft} />
            <Text variant="small" color={colors.muted}>
              Checking camera permission
            </Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionState}>
            <View style={styles.permissionIcon}>
              <Camera size={26} color={colors.indigoSoft} strokeWidth={1.7} />
            </View>
            <Text variant="subheading" align="center">
              Camera access needed
            </Text>
            <Text variant="small" color={colors.muted} align="center" style={styles.permissionCopy}>
              VorldX uses the camera only to read the office attendance QR code.
            </Text>
            <Button
              label={permission.canAskAgain ? 'Allow camera' : 'Open settings'}
              onPress={() => {
                if (permission.canAskAgain) void requestPermission();
                else void Linking.openSettings();
              }}
              size="sm"
              fullWidth={false}
              icon={
                permission.canAskAgain ? (
                  <Camera size={15} color={colors.white} strokeWidth={2} />
                ) : (
                  <Settings size={15} color={colors.white} strokeWidth={2} />
                )
              }
              style={styles.permissionButton}
            />
            <Button
              label="Use WFH instead"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => router.navigate('/wfh')}
            />
          </View>
        ) : !focused ? (
          <View style={styles.permissionState}>
            <QrCode size={28} color={colors.muted} strokeWidth={1.6} />
            <Text variant="small" color={colors.muted}>
              Camera paused while this tab is not active.
            </Text>
          </View>
        ) : (
          <>
            <CameraView
              active={focused}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              enableTorch={torchOn}
              facing="back"
              onBarcodeScanned={paused ? undefined : (event) => void handleScan(event)}
              onMountError={(event) => setCameraError(event.message)}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.cameraShade} />
            <ScannerOverlay paused={paused && !scanning} />
            {cameraError ? (
              <View pointerEvents="none" style={styles.cameraError}>
                <AlertCircle size={15} color={colors.danger} strokeWidth={2} />
                <Text variant="small" color={colors.danger} align="center">
                  {cameraError}
                </Text>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.cameraTop}>
          <View style={styles.cameraBadge}>
            <QrCode size={13} color={colors.indigoSoft} strokeWidth={2} />
            <Text variant="caption" color={colors.indigoSoft}>
              VorldX office QR
            </Text>
          </View>
          {cameraAllowed && permission?.granted ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={torchOn ? 'Turn torch off' : 'Turn torch on'}
              haptic="selection"
              onPress={() => setTorch((value) => !value)}
              style={styles.torchButton}>
              {torchOn ? (
                <ZapOff size={17} color={colors.text} strokeWidth={1.9} />
              ) : (
                <Zap size={17} color={colors.text} strokeWidth={1.9} />
              )}
            </PressableScale>
          ) : null}
        </View>

        {scanning ? (
          <View style={styles.scanningOverlay}>
            <View style={styles.scanningPill}>
              <ActivityIndicator color={colors.indigoSoft} size="small" />
              <Text variant="small" color={colors.text}>
                Recording attendance
              </Text>
            </View>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultOverlay}>
            <Card padding={16} tone={result.tone} variant="raised">
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.resultIcon,
                    { backgroundColor: tones[result.tone].bg },
                  ]}>
                  {result.tone === 'success' ? (
                    <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
                  ) : (
                    <AlertCircle size={20} color={colors.danger} strokeWidth={2} />
                  )}
                </View>
                <View style={styles.resultCopy}>
                  <Text variant="subheading">{result.title}</Text>
                  <Text variant="small" color={colors.textSecondary}>
                    {result.message}
                  </Text>
                </View>
              </View>
              <View style={styles.resultActions}>
                <Button
                  label="Scan again"
                  onPress={scanAgain}
                  size="sm"
                  variant="secondary"
                  icon={<RotateCcw size={14} color={colors.text} strokeWidth={2} />}
                  style={styles.resultButton}
                />
                <Button
                  label="My attendance"
                  onPress={() => router.push('/attendance')}
                  size="sm"
                  icon={<ArrowRight size={14} color={colors.white} strokeWidth={2} />}
                  style={styles.resultButton}
                />
              </View>
            </Card>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <ScanLine size={14} color={colors.muted} strokeWidth={1.9} />
          <Text variant="small" color={colors.muted}>
            Hold steady inside the frame
          </Text>
        </View>
        <View style={styles.footerItem}>
          <Clock3 size={14} color={colors.muted} strokeWidth={1.9} />
          <Text variant="small" color={colors.muted}>
            QR rotates every 18 seconds
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function ScannerOverlay({ paused }: { paused: boolean }) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (paused) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    opacity.value = withRepeat(withTiming(0.45, { duration: 900 }), -1, true);
  }, [opacity, paused, progress]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * 194 }],
    opacity: opacity.value,
  }));

  return (
    <View pointerEvents="none" style={styles.scanFrame}>
      <View style={[styles.corner, styles.cornerTopLeft]} />
      <View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} />
      <View style={[styles.corner, styles.cornerBottomRight]} />
      <Animated.View style={[styles.scanLine, lineStyle]} />
    </View>
  );
}

function CameraUnavailable({ message, onWfh }: { message: string; onWfh: () => void }) {
  return (
    <View style={styles.permissionState}>
      <View style={styles.permissionIcon}>
        <Camera size={26} color={colors.indigoSoft} strokeWidth={1.7} />
      </View>
      <Text variant="subheading" align="center">
        Camera needs a physical phone
      </Text>
      <Text variant="small" color={colors.muted} align="center" style={styles.permissionCopy}>
        {message}
      </Text>
      <Button
        label="Use WFH check-in"
        onPress={onWfh}
        size="sm"
        fullWidth={false}
        icon={<Home size={15} color={colors.white} strokeWidth={2} />}
        style={styles.permissionButton}
      />
    </View>
  );
}

const FRAME_SIZE = 218;

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusText: {
    flex: 1,
  },
  cameraCard: {
    flex: 1,
    minHeight: 330,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgRaised,
  },
  cameraShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 5, 12, 0.18)',
  },
  cameraTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(7, 8, 14, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(140, 149, 255, 0.28)',
  },
  torchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 8, 14, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  scanFrame: {
    position: 'absolute',
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    left: '50%',
    top: '50%',
    marginLeft: -FRAME_SIZE / 2,
    marginTop: -FRAME_SIZE / 2 - 12,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.indigoSoft,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 8,
    height: 1.5,
    backgroundColor: colors.indigoSoft,
    shadowColor: colors.indigoSoft,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  permissionState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.24)',
    marginBottom: spacing.xs,
  },
  permissionCopy: {
    maxWidth: 290,
  },
  permissionButton: {
    marginTop: spacing.sm,
  },
  cameraError: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    alignItems: 'center',
    gap: 5,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(7, 8, 14, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 131, 0.3)',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 5, 12, 0.5)',
  },
  scanningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(7, 8, 14, 0.9)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCopy: {
    flex: 1,
    gap: 2,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  resultButton: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
