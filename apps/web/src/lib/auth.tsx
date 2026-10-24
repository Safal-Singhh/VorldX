import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Company, Membership, Role } from "./types";

interface AuthState {
  userId: string | null;
  email: string | null;
  memberships: Membership[];
  company: Company | null;
  role: Role | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ userId: null, email: null, memberships: [], company: null, role: null, loading: true, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setUserId(null); setEmail(null); setMemberships([]); setLoading(false); return; }
    setUserId(session.user.id); setEmail(session.user.email ?? null);
    const { data } = await supabase.from("company_memberships").select("*, companies(*)").eq("user_id", session.user.id).eq("status", "active");
    setMemberships((data ?? []) as Membership[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, []);

  const active = memberships[0] ?? null;
  return (
    <Ctx.Provider value={{
      userId, email, memberships,
      company: active?.companies ?? null,
      role: (active?.role as Role) ?? null,
      loading, refresh: load,
      signOut: async () => { await supabase.auth.signOut(); await load(); },
    }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
