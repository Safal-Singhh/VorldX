import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Badge, PageHeader } from "../../components/ui";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { edgeText, friendlyEdgeError, useHrEmployee } from "./attendanceUtil";

function QrCamera({ employeeId, onDone }: { employeeId: string; onDone: (msg: string, ok: boolean) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const startedRef = useRef(false);
  const [state, setState] = useState<"starting" | "scanning" | "error">("starting");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let scanner: { stop: () => Promise<unknown>; clear: () => unknown } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !boxRef.current) return;
        const h = new Html5Qrcode("vorldx-qr-reader");
        scanner = h;
        setState("scanning");
        await h.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decoded: string) => {
            if (doneRef.current) return;
            doneRef.current = true;
            try { await h.stop(); startedRef.current = false; } catch { /* ignore */ }
            try {
              const { data, error } = await supabase.functions.invoke("process-office-attendance", { body: { token: decoded, employee_id: employeeId } });
              const serverErr = (data as { error?: string } | null)?.error;
              if (error || serverErr) onDone(friendlyEdgeError(serverErr) ?? (await edgeText(error)), false);
              else {
                const r = data as { check_in_at: string; check_out_at: string | null; status: string };
                if (r.check_out_at) onDone(`Checked out at ${new Date(r.check_out_at).toLocaleTimeString()}. Day complete.`, true);
                else onDone(`Checked in at ${new Date(r.check_in_at).toLocaleTimeString()} (${r.status}). Press \u201cScan to check out\u201d when leaving.`, true);
              }
            } catch (e) { onDone(e instanceof Error ? e.message : "Request failed. Check connection and retry.", false); }
          },
          () => { /* per-frame decode miss, ignore */ }
        );
        if (!cancelled) startedRef.current = true;
      } catch {
        if (!cancelled) { setState("error"); setDetail("Camera unavailable or permission denied. Allow camera access and retry."); }
      }
    })();
    return () => {
      cancelled = true;
      const s = scanner;
      const wasStarted = startedRef.current;
      startedRef.current = false;
      // Awaited, ordered teardown: stop first, then clear — never clear mid-scan.
      (async () => {
        try { if (s && wasStarted) await s.stop(); } catch { /* already stopped */ }
        try { if (s) await Promise.resolve(s.clear()); } catch { /* nothing to clear */ }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  if (state === "error") return <div className="text-sm" style={{ color: "var(--vx-danger)" }}>{detail}</div>;
  return (
    <div>
      <div id="vorldx-qr-reader" ref={boxRef} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--vx-border)" }} />
      <div className="text-xs mono opacity-60 mt-2">{state === "starting" ? "Requesting camera…" : "Point the camera at the office display. Codes refresh every 18 seconds."}</div>
    </div>
  );
}

export function HrQrAttendance() {
  const { me, today, recordChecked, load } = useHrEmployee();
  const [scanKey, setScanKey] = useState(0);
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const officeInProgress = !!today && today.attendance_type === "office" && !today.check_out_at;
  const isAbsent = today?.status === "absent";
  const nonOfficeInProgress = !!today && !officeInProgress && !today.check_out_at && !isAbsent;
  // Camera runs only when actively needed: nothing recorded yet, or the user armed
  // it for the check-out scan (never auto-restarts mid-day).
  const scanning = !!me && (!today || (armed && officeInProgress));

  return (
    <div>
      <PageHeader title="QR office attendance" sub="First scan checks in, second scan checks out. The camera only runs while scanning." />
      <div className="glass p-5 max-w-xl grid gap-3 text-sm">
        {recordChecked && !me && (
          <div className="glass p-3" style={{ border: "1px solid var(--vx-border-active)" }}>
            No active employee record found for this login. Ask your Admin to create/link it, then press Refresh.
            <div className="mt-2"><button className="input" style={{ width: "auto" }} onClick={load}>Refresh</button></div>
          </div>
        )}
        <div>Today: {today ? (
          isAbsent ? (
            <><Badge tone="bad">absent</Badge> <span className="opacity-70">No check-in by shift end. Ask HR or Admin to correct it if you were present.</span></>
          ) : (
            <><Badge tone={today.status === "late" ? "warn" : "ok"}>{today.status} · {today.attendance_type}</Badge> <span className="mono">in {today.check_in_at ? new Date(today.check_in_at).toLocaleTimeString() : "—"}{today.check_out_at ? ` · out ${new Date(today.check_out_at).toLocaleTimeString()}` : " · In progress"}</span></>
          )
        ) : "No record yet today."}</div>
        {!me ? <div className="opacity-70">Waiting for employee record…</div> : (
          <>
            {!today && <div className="opacity-70">No check-in yet today. Point the camera at the office display QR.</div>}
            {isAbsent && <div className="opacity-70">Check-in is closed for today because you are marked absent. Contact HR or Admin for a correction.</div>}
            {today && today.check_out_at && <div className="opacity-70">Day complete. Checked out at {new Date(today.check_out_at).toLocaleTimeString()}.</div>}
            {today && officeInProgress && (
              <div className="opacity-70">
                Checked in at {today.check_in_at ? new Date(today.check_in_at).toLocaleTimeString() : "—"}. {armed ? "Scan the display QR to check out." : "Press \u201cScan to check out\u201d when leaving. The camera only runs while you scan."}
              </div>
            )}
            {today && nonOfficeInProgress && <div className="opacity-70">This day started via {today.attendance_type}. Check out from the WFH attendance page using your passcode.</div>}
            {scanning && (
              <ErrorBoundary fallback={<div className="text-sm" style={{ color: "var(--vx-danger)" }}>Scanner failed to start. Reload the page and allow camera access.</div>}>
                <QrCamera key={scanKey} employeeId={me.id} onDone={(m, good) => { setMsg(m); setOk(good); if (good) { setArmed(false); load(); } }} />
              </ErrorBoundary>
            )}
            {scanning && <button className="input" style={{ maxWidth: 200 }} onClick={() => setScanKey((k) => k + 1)}>Restart scanner</button>}
            {!scanning && today && officeInProgress && (
              <button className="btn-primary" style={{ maxWidth: 220 }} onClick={() => { setMsg(""); setOk(false); setArmed(true); setScanKey((k) => k + 1); }}>Scan to check out</button>
            )}
          </>
        )}
        {msg && <div style={{ color: ok ? "var(--vx-success)" : "var(--vx-danger)" }}>{msg}</div>}
      </div>
    </div>
  );
}
