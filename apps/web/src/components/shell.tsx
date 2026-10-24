import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, CalendarCheck, Inbox, Settings, MonitorSmartphone, MessageSquareHeart, User } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AmbientBackground } from "./ambient";

const NAV = [
  { group: "Overview", items: [{ to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "People", items: [{ to: "/admin/hr", label: "HR management", icon: Users }] },
  { group: "Attendance", items: [
    { to: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/admin/qr-displays", label: "QR displays", icon: MonitorSmartphone },
  ]},
  { group: "Requests", items: [
    { to: "/admin/wfh-requests", label: "HR WFH requests", icon: Inbox },
    { to: "/admin/leave-requests", label: "HR Leave requests", icon: Inbox },
  ]},
  { group: "Feedback", items: [{ to: "/admin/feedback", label: "HR feedback", icon: MessageSquareHeart }] },
  { group: "Settings", items: [
    { to: "/admin/policies", label: "Policies", icon: Settings },
    { to: "/admin/profile", label: "Profile", icon: User },
  ]},
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { company, email, signOut } = useAuth();
  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <AmbientBackground variant="ambient" />
      <aside className="w-60 p-4 hidden md:flex flex-col gap-4 relative z-10" style={{ background: "var(--vx-sidebar)", borderRight: "1px solid var(--vx-border)" }}>
        <div>
          <div className="brand text-lg">VorldX</div>
          <div className="text-[11px]" style={{ color: "var(--vx-text-muted)" }}>Admin</div>
          <div className="text-xs mt-1 truncate" style={{ color: "var(--vx-text-secondary)" }}>{company?.name ?? ""}</div>
        </div>
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="text-[11px] uppercase eyebrow mb-1" style={{ color: "var(--vx-text-muted)" }}>{g.group}</div>
            {g.items.map((it) => {
              const active = loc.pathname === it.to;
              const Icon = it.icon;
              return (
                <Link key={it.to} to={it.to} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm"
                  style={active ? { background: "rgba(89,101,242,.18)", borderLeft: "2px solid var(--vx-indigo)" } : { opacity: 0.85 }}>
                  <Icon size={15} /> {it.label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="mt-auto text-xs" style={{ color: "var(--vx-text-muted)" }}>
          <div className="truncate">{email}</div>
          <button className="underline" onClick={async () => { await signOut(); nav("/login"); }}>Sign out</button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 relative z-[1]">
        <div className="md:hidden p-3 flex gap-2 overflow-x-auto text-sm" style={{ borderBottom: "1px solid var(--vx-border)" }}>
          {NAV.flatMap((g) => g.items).map((it) => <Link key={it.to} to={it.to} className="whitespace-nowrap opacity-80">{it.label}</Link>)}
        </div>
        <main className="p-4 md:p-6 max-w-6xl w-full">{children}</main>
      </div>
    </div>
  );
}
