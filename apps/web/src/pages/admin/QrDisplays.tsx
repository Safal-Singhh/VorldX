import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Badge, Empty, Field, Modal, PageHeader } from "../../components/ui";
import type { QrDisplay } from "../../lib/types";

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randomSecret() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function AdminQr() {
  const { company } = useAuth();
  const [rows, setRows] = useState<QrDisplay[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", office_name: "HQ" });
  const [keyFor, setKeyFor] = useState<QrDisplay | null>(null);
  const [deviceLink, setDeviceLink] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!company) return;
    const { data } = await supabase.from("qr_displays").select("*").eq("company_id", company.id).order("paired_at", { ascending: false });
    setRows((data ?? []) as QrDisplay[]);
  };
  useEffect(() => { load(); }, [company]);

  const pair = async () => {
    await supabase.from("qr_displays").insert({ company_id: company!.id, display_name: form.display_name, office_name: form.office_name, is_active: true });
    setOpen(false); setForm({ display_name: "", office_name: "HQ" }); load();
  };
  const toggle = async (d: QrDisplay) => {
    await supabase.from("qr_displays").update({ is_active: !d.is_active }).eq("id", d.id);
    load();
  };

  const openKey = (d: QrDisplay) => { setKeyFor(d); setDeviceLink(""); setNote(""); setCopied(false); };

  const generateKey = async () => {
    if (!keyFor) return;
    if (keyFor.device_secret_hash && !window.confirm("Generate a new device key? The current office screen will stop working until you open the new link on it.")) return;
    setBusy(true);
    const raw = randomSecret();
    const hash = await sha256Hex(raw);
    const { error } = await supabase.from("qr_displays").update({ device_secret_hash: hash }).eq("id", keyFor.id);
    setBusy(false);
    if (error) { setNote(`Failed: ${error.message}`); return; }
    setDeviceLink(`${window.location.origin}/display/${keyFor.id}?key=${raw}`);
    setNote("Key created. The office screen must use this key before any QR code is issued. Open the link once on the office PC; the key is stored there and removed from the URL.");
    load();
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(deviceLink); setCopied(true); }
    catch { setNote("Copy failed. Select the link and copy it manually."); }
  };

  return (
    <div>
      <PageHeader
        title="QR displays"
        sub="Each screen needs its own device key. Codes refresh every 18 seconds."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>Pair display</button>}
      />
      {rows.length === 0 ? <Empty msg="No displays paired." /> : (
        <div className="grid gap-2">{rows.map((d) => (
          <div key={d.id} className="glass p-4 flex justify-between items-center">
            <div>
              <div className="font-semibold text-sm">{d.display_name} <span className="opacity-60">· {d.office_name}</span></div>
              <div className="text-xs mono opacity-60">Last seen {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "never"} · device key {d.device_secret_hash ? "set" : "not set"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={d.is_active ? "ok" : "bad"}>{d.is_active ? "Active" : "Disabled"}</Badge>
              <button className="input text-xs" style={{ width: "auto" }} onClick={() => openKey(d)}>Device key</button>
              <button className="text-xs underline" onClick={() => toggle(d)}>{d.is_active ? "Disable" : "Enable"}</button>
            </div>
          </div>))}</div>
      )}
      <Modal open={open} title="Pair display" onClose={() => setOpen(false)}>
        <div className="grid gap-3">
          <Field label="Display name"><input className="input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
          <Field label="Office"><input className="input" value={form.office_name} onChange={(e) => setForm({ ...form, office_name: e.target.value })} /></Field>
          <button className="btn-primary" onClick={pair}>Pair</button>
        </div>
      </Modal>
      <Modal open={!!keyFor} title={`Device key · ${keyFor?.display_name ?? ""}`} onClose={() => setKeyFor(null)}>
        <div className="grid gap-3">
          <div className="text-xs opacity-70">
            A display link alone cannot issue QR codes. Generate a key, then open the link once on the office PC.
          </div>
          {keyFor?.device_secret_hash && !deviceLink && (
            <div className="text-xs mono opacity-60">A key is already set. The old key cannot be shown again, so regenerate to get a new link.</div>
          )}
          <button className="btn-primary" disabled={busy} onClick={generateKey}>
            {busy ? "Generating…" : keyFor?.device_secret_hash ? "Regenerate device key" : "Generate device key"}
          </button>
          {note && <div className="text-xs opacity-80">{note}</div>}
          {deviceLink && (
            <div className="grid gap-2">
              <div className="mono text-xs break-all glass p-2">{deviceLink}</div>
              <div className="flex gap-2">
                <button className="input text-xs" style={{ width: "auto" }} onClick={copyLink}>{copied ? "Copied ✓" : "Copy link"}</button>
                <a className="input text-xs" style={{ width: "auto" }} href={deviceLink} target="_blank" rel="noreferrer">Open display</a>
              </div>
              <div className="text-xs opacity-60">Shown once. Keep this link safe.</div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
