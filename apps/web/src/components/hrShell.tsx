import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, CalendarCheck, Inbox, Settings, MessageSquareHeart, User, History, QrCode, KeyRound } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AmbientBackground } from "./ambient";

const NAV = [
  { group: "Overview", items: [{ to: "/hr/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "People", items: [{ to: "/hr/employees", label: "Employees", icon: Users }] },
  { group: "Attendance", items: [
    { to: "/hr/attendance", label: "Team attendance", icon: CalendarCheck },
    { to: "/hr/qr-attendance", label: "QR attendance", icon: QrCode },
    { to: "/hr/wfh-attendance", label: "WFH attendance", icon: KeyRound },
    { to: "/hr/my-attendance", label: "My attendance", icon: History },
  ]},
  { group: "Requests", items: [
    { to: "/hr/wfh-requests", label: "Employee WFH", icon: Inbox },
    { to: "/hr/leave-requests", label: "Employee Leave", icon: Inbox },
    { to: "/hr/my-wfh-requests", label: "My WFH requests", icon: Inbox },
    { to: "/hr/my-leave-requests", label: "My leave requests", icon: Inbox },
  ]},
  { group: "Feedback", items: [
    { to: "/hr/feedback", label: "Give feedback", icon: MessageSquareHeart },
    { to: "/hr/my-feedback", label: "My feedback", icon: MessageSquareHeart },
  ]},
  { group: "Settings", items: [
    { to: "/hr/policies", label: "Policies", icon: Settings },
    { to: "/hr/profile", label: "Profile", icon: User },
  ]},
];

export function HrShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { company, email, signOut } = useAuth();
  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <AmbientBackground variant="ambient" />
      <aside className="w-60 p-4 hidden md:flex flex-col gap-4 relative z-10" style={{ background: "var(--vx-sidebar)", borderRight: "1px solid var(--vx-border)" }}>
        <div>
          <div className="brand text-lg">VorldX</div>
          <div className="text-[11px]" style={{ color: "var(--vx-text-muted)" }}>HR</div>
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
