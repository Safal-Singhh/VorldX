import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { supabase, supabaseConfigured } from './supabase';
import type {
  AttendancePolicy,
  Company,
  Employee,
  Membership,
  Shift,
} from './types';

interface AuthContextValue {
  session: Session | null;
  employee: Employee | null;
  company: Company | null;
  shift: Shift | null;
  policy: AttendancePolicy | null;
  membership: Membership | null;
  loading: boolean;
  accessError: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPLOYEE_ONLY_MESSAGE =
  'This app is for employees only. Admin and HR accounts should use the VorldX web dashboard.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [initializing, setInitializing] = useState(supabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    supabaseConfigured ? null : 'The app is missing its Supabase configuration.',
  );
  const requestId = useRef(0);

  const clearProfile = useCallback(() => {
    setEmployee(null);
    setCompany(null);
    setShift(null);
    setPolicy(null);
    setMembership(null);
    setAccessError(null);
    setError(null);
  }, []);

  const loadProfile = useCallback(
    async (userId: string | null) => {
      const current = requestId.current + 1;
      requestId.current = current;

      if (!userId) {
        clearProfile();
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setError(null);
      setAccessError(null);

      try {
        const { data: memberships, error: membershipError } = await supabase
          .from('company_memberships')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(8);

        if (current !== requestId.current) return;
        if (membershipError) throw membershipError;

        const employeeMembership = ((memberships ?? []) as Membership[]).find(
          (row) => row.role === 'employee',
        );

        if (!employeeMembership) {
          setEmployee(null);
          setCompany(null);
          setShift(null);
          setPolicy(null);
          setMembership(null);
          setAccessError(EMPLOYEE_ONLY_MESSAGE);
          return;
        }

        const { data: employeeRow, error: employeeError } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', userId)
          .eq('company_id', employeeMembership.company_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (current !== requestId.current) return;
        if (employeeError) throw employeeError;
        if (!employeeRow) {
          setEmployee(null);
          setCompany(null);
          setShift(null);
          setPolicy(null);
          setMembership(employeeMembership);
          setAccessError(
            'Your login is active, but no active employee record is linked to it. Contact your HR or Admin.',
          );
          return;
        }

        const employeeData = employeeRow as Employee;

        const [companyResult, policyResult, shiftResult] = await Promise.all([
          supabase.from('companies').select('*').eq('id', employeeData.company_id).maybeSingle(),
          supabase
            .from('attendance_policies')
            .select('*')
            .eq('company_id', employeeData.company_id)
            .maybeSingle(),
          employeeData.shift_id
            ? supabase.from('shifts').select('*').eq('id', employeeData.shift_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (current !== requestId.current) return;
        if (companyResult.error) throw companyResult.error;
        if (policyResult.error) throw policyResult.error;
        if ('error' in shiftResult && shiftResult.error) throw shiftResult.error;

        setEmployee(employeeData);
        setMembership(employeeMembership);
        setCompany((companyResult.data ?? null) as Company | null);
        setPolicy((policyResult.data ?? null) as AttendancePolicy | null);
        setShift((shiftResult.data ?? null) as Shift | null);
      } catch (loadError) {
        if (current !== requestId.current) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (current === requestId.current) setProfileLoading(false);
      }
    },
    [clearProfile],
  );

  useEffect(() => {
    if (!supabaseConfigured) return;

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (initializing) return;
    // Session state comes from the Supabase auth subscription; profile loads are
    // guarded by requestId so stale responses never override fresher ones.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external auth store
    void loadProfile(userId);
  }, [userId, initializing, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) return signInError.message;
    return null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    setSession(null);
    clearProfile();
  }, [queryClient, clearProfile]);

  const refresh = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      employee,
      company,
      shift,
      policy,
      membership,
      loading: initializing || profileLoading,
      accessError,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [
      session,
      employee,
      company,
      shift,
      policy,
      membership,
      initializing,
      profileLoading,
      accessError,
      error,
      signIn,
      signOut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
