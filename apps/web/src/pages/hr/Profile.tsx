import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { PageHeader } from "../../components/ui";
import { ChangePassword } from "../../components/ChangePassword";

export function HrProfile() {
  const { company, userId } = useAuth();
  const [name, setName] = useState("");
  const [emp, setEmp] = useState<{ employee_code: string; department: string; designation: string; joining_date: string } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
      if (p) setName((p as { full_name: string }).full_name);
      const { data: e } = await supabase.from("employees").select("employee_code,department,designation,joining_date").eq("user_id", userId).limit(1).single();
      if (e) setEmp(e as never);
    })();
  }, [userId]);

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="glass p-5 grid gap-3 max-w-md text-sm">
        <div>Company <b>{company?.name}</b></div>
        {emp && <div className="mono opacity-70">{emp.employee_code} · {emp.department} · {emp.designation} · joined {emp.joining_date}</div>}
        <label className="block">Full name<input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn-primary" onClick={async () => {
          await supabase.from("profiles").update({ full_name: name }).eq("id", userId!);
          setMsg("Saved.");
        }}>Save</button>
        {msg && <div>{msg}</div>}
      </div>
      <ChangePassword />
    </div>
  );
}
