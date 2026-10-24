import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/ui";
import { ChangePassword } from "../../components/ChangePassword";

export function AdminProfile() {
  const { company, userId } = useAuth();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
      if (data) setName((data as { full_name: string }).full_name);
    })();
  }, [userId]);

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="glass p-5 grid gap-3 max-w-md">
        <div className="text-sm">Company <span className="font-semibold">{company?.name}</span> <span className="mono opacity-60">{company?.slug}</span></div>
        <label className="block text-sm">Full name<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn-primary" onClick={async () => {
          await supabase.from("profiles").update({ full_name: name }).eq("id", userId!);
          setMsg("Saved. Attendance recorded with exact timestamps.");
        }}>Save</button>
        {msg && <div className="text-sm">{msg}</div>}
      </div>
      <ChangePassword />
    </div>
  );
}
