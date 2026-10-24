import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import {
  fetchAttendanceBetween,
  fetchAttendanceRecent,
  fetchFeedback,
  fetchLeaveRequests,
  fetchWfhPasscode,
  fetchWfhRequests,
} from '@/lib/api';
import { monthBounds } from '@/lib/dates';
import type { WfhPasscode, WfhRequest } from '@/lib/types';

export function useRecentAttendance(limit = 90) {
  const { employee } = useAuth();
  return useQuery({
    queryKey: ['attendance-recent', employee?.id, limit],
    queryFn: () => fetchAttendanceRecent(limit),
    enabled: Boolean(employee?.id),
  });
}

export function useAttendanceForMonth(month: Date) {
  const { employee } = useAuth();
  const bounds = monthBounds(month);
  return useQuery({
    queryKey: ['attendance-month', employee?.id, bounds.start, bounds.end],
    queryFn: () => fetchAttendanceBetween(bounds.start, bounds.end),
    enabled: Boolean(employee?.id),
  });
}

export function useWfhRequests(limit = 40) {
  const { employee } = useAuth();
  return useQuery({
    queryKey: ['wfh-requests', employee?.id, limit],
    queryFn: () => fetchWfhRequests(limit),
    enabled: Boolean(employee?.id),
  });
}

export function useLeaveRequests(limit = 100) {
  const { employee } = useAuth();
  return useQuery({
    queryKey: ['leave-requests', employee?.id, limit],
    queryFn: () => fetchLeaveRequests(limit),
    enabled: Boolean(employee?.id),
  });
}

export function useFeedback() {
  const { employee } = useAuth();
  return useQuery({
    queryKey: ['feedback', employee?.id],
    queryFn: fetchFeedback,
    enabled: Boolean(employee?.id),
  });
}

export function useWfhPasscode(requestId: string | null | undefined) {
  const { employee } = useAuth();
  return useQuery({
    queryKey: ['wfh-passcode', employee?.id, requestId],
    queryFn: () => fetchWfhPasscode(requestId as string),
    enabled: Boolean(employee?.id && requestId),
    staleTime: 15_000,
  });
}

export function useWfhPasscodes(requests: WfhRequest[]) {
  const { employee } = useAuth();
  const approved = useMemo(
    () =>
      requests
        .filter((request) => request.status === 'approved')
        .sort((a, b) => b.request_date.localeCompare(a.request_date))
        .slice(0, 14),
    [requests],
  );
  const ids = approved.map((request) => request.id);

  return useQuery({
    queryKey: ['wfh-passcodes', employee?.id, ids.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        approved.map(async (request) => {
          try {
            const passcode = await fetchWfhPasscode(request.id);
            return [request.id, passcode] as const;
          } catch {
            return [request.id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, WfhPasscode | null>;
    },
    enabled: Boolean(employee?.id && ids.length),
    staleTime: 15_000,
  });
}
