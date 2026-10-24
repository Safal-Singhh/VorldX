import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabase";

type Status = "Connected" | "Refreshing" | "Offline" | "Disabled" | "NoKey";

const keyStorage = (id: string) => `vx_display_key_${id}`;

export function QrDisplay() {
  const { displayId } = useParams();
  // Device key: captured once from the pairing link (?key=...), then kept in localStorage.
  // Only its fingerprint is stored server-side — a leaked /display/<uuid> URL is useless alone.
  const [deviceKey] = useState<string | null>(() => {
    if (!displayId) return null;
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    return fromUrl ?? window.localStorage.getItem(keyStorage(displayId));
  });
  const [token, setToken] = useState("");
  const [expires, setExpires] = useState("");
  const [status, setStatus] = useState<Status>("Refreshing");
  const [left, setLeft] = useState(18);
  const retry = useRef<number | null>(null);

  useEffect(() => {
    if (!displayId || !deviceKey) return;
    window.localStorage.setItem(keyStorage(displayId), deviceKey);
    if (new URLSearchParams(window.location.search).has("key")) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [displayId, deviceKey]);

  const fetchQr = async () => {
    if (!displayId) return;
    if (!deviceKey) { setStatus("NoKey"); return; }
    setStatus("Refreshing");
    const { data, error } = await supabase.functions.invoke("issue-office-qr", {
      body: { display_id: displayId, device_secret: deviceKey },
    });
    if (error || (data as { error?: string })?.error) {
      let msg = error?.message ?? (data as { error: string }).error;
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const b = (await ctx.json()) as { error?: string };
          if (b?.error) msg = b.error;
        } catch { /* body already consumed or empty */ }
      }
      if (msg.includes("RATE_LIMITED")) {
        setStatus("Refreshing");
        if (retry.current) window.clearTimeout(retry.current);
        retry.current = window.setTimeout(fetchQr, 4_000);
        return;
      }
      setStatus(msg.includes("DEVICE_KEY") ? "NoKey" : msg.includes("DISPLAY") ? "Disabled" : "Offline");
      return;
    }
    setToken((data as { token: string }).token);
    setExpires((data as { expires_at: string }).expires_at);
    setStatus("Connected");
    setLeft(18);
  };

  useEffect(() => {
    fetchQr();
    const iv = window.setInterval(fetchQr, 18_000);
    const cd = window.setInterval(() => setLeft((v) => (v <= 1 ? 18 : v - 1)), 1000);
    return () => {
      window.clearInterval(iv);
      window.clearInterval(cd);
      if (retry.current) window.clearTimeout(retry.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayId, deviceKey]);

  return (
    <div className="min-h-screen grid place-items-center p-6" style={{ background: "#07080E" }}>
      <div className="text-center">
        <div className="brand text-xl mb-1">VorldX</div>
        <div className="text-xs mono opacity-60 mb-4">Office display · {displayId?.slice(0, 8)}</div>
        <div className="p-4 inline-block rounded-2xl" style={{ background: "#F4F5FF" }}>
          {status === "Connected" && token ? <QRCodeSVG value={token} size={280} /> : (
            <div className="w-[280px] h-[280px] grid place-items-center text-black text-sm p-6">
              {status === "NoKey"
                ? "This screen is not paired. Open it with the pairing link from QR displays."
                : status === "Disabled"
                  ? "Display disabled"
                  : status === "Offline"
                    ? "Offline. Retrying."
                    : "Loading…"}
            </div>
          )}
        </div>
        <div className="mt-3 text-sm mono">Refreshes in {left}s · {status}</div>
        <div className="text-xs mono opacity-60">Last refreshed {expires ? new Date(expires).toLocaleTimeString() : "—"}</div>
      </div>
    </div>
  );
}
