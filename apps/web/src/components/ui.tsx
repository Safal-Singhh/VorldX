import type { ReactNode } from "react";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub && <p className="text-sm mt-1" style={{ color: "var(--vx-text-secondary)" }}>{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="glass p-5">
      <div className="text-xs uppercase eyebrow" style={{ color: "var(--vx-text-muted)" }}>{label}</div>
      <div className="text-2xl font-bold mono mt-1">{value}</div>
      {hint && <div className="text-xs mt-1" style={{ color: "var(--vx-text-secondary)" }}>{hint}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "info" | "muted"; children: ReactNode }) {
  const bg: Record<string, string> = {
    ok: "rgba(69,214,166,.15)", warn: "rgba(245,199,107,.15)",
    bad: "rgba(255,107,131,.15)", info: "rgba(118,184,255,.15)", muted: "rgba(184,190,255,.12)",
  };
  const fg: Record<string, string> = {
    ok: "var(--vx-success)", warn: "var(--vx-warning)",
    bad: "var(--vx-danger)", info: "var(--vx-info)", muted: "var(--vx-text-secondary)",
  };
  return <span className="badge" style={{ background: bg[tone], color: fg[tone] }}>{children}</span>;
}

export function Empty({ msg }: { msg: string }) {
  return <div className="glass-strong p-8 text-center text-sm" style={{ color: "var(--vx-text-secondary)" }}>{msg}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1" style={{ color: "var(--vx-text-secondary)" }}>{label}</div>
      {children}
      {hint && <div className="text-xs mt-1" style={{ color: "var(--vx-text-muted)" }}>{hint}</div>}
    </label>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div className="glass-strong p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">{title}</h2>
          <button className="text-sm opacity-70" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
