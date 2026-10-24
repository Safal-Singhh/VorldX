import { Tabs } from 'expo-router/tabs';
import {
  FileText,
  House,
  LayoutDashboard,
  QrCode,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, layout, radii } from '@/constants/theme';
import { useWfhRequests, useLeaveRequests } from '@/hooks/use-data';
import { useResponsive } from '@/lib/responsive';

function TabIcon({
  icon: Icon,
  color,
  focused,
}: {
  icon: LucideIcon;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused ? styles.iconWrapActive : null]}>
      <Icon size={21} color={color} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { data: wfhRequests } = useWfhRequests(30);
  const { data: leaveRequests } = useLeaveRequests(60);

  const pending = useMemo(() => {
    const wfh = (wfhRequests ?? []).filter((request) => request.status === 'pending').length;
    const leave = (leaveRequests ?? []).filter((request) => request.status === 'pending').length;
    return wfh + leave;
  }, [wfhRequests, leaveRequests]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarVariant: isWide ? 'material' : 'uikit',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarActiveBackgroundColor: isWide ? 'rgba(89, 101, 242, 0.12)' : 'transparent',
        tabBarStyle: isWide
          ? [
              styles.sideBar,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]
          : [
              styles.bottomBar,
              {
                height: 58 + Math.max(insets.bottom, 8),
                paddingBottom: Math.max(insets.bottom, 8),
              },
            ],
        tabBarItemStyle: isWide ? styles.sideItem : styles.bottomItem,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={LayoutDashboard} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={QrCode} />
          ),
        }}
      />
      <Tabs.Screen
        name="wfh"
        options={{
          title: 'WFH',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={House} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={FileText} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={UserRound} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: 'rgba(10, 12, 21, 0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 7,
    paddingHorizontal: 6,
  },
  sideBar: {
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    width: isWideSidebar(),
    paddingHorizontal: 10,
  },
  bottomItem: {
    borderRadius: radii.sm,
    paddingVertical: 1,
  },
  sideItem: {
    borderRadius: radii.md,
    marginVertical: 4,
    marginHorizontal: 0,
    height: 62,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 13,
  },
  iconWrap: {
    width: 38,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(89, 101, 242, 0.14)',
  },
  badge: {
    backgroundColor: colors.danger,
    color: colors.white,
    fontFamily: fonts.semibold,
    fontSize: 9,
    minWidth: 16,
    height: 16,
    lineHeight: 16,
  },
});

function isWideSidebar(): number {
  return layout.sidebarWidth;
}
