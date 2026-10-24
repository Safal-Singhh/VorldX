import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { Employee, Role } from "./types";

export interface DirectoryEmployee extends Employee {
  role: Role;
}

/**
 * Company directory with active membership roles. Unlinked employee records
 * are treated as employees because they are pre-activation roster rows.
 */
export function useCompanyDirectory(companyId: string | undefined) {
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [roleByUser, setRoleByUser] = useState<Map<string, Role>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setEmployees([]);
      setRoleByUser(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [{ data: emps }, { data: roles }] = await Promise.all([
        supabase.from("employees").select("*").eq("company_id", companyId).order("full_name"),
        supabase.rpc("company_role_map", { p_company_id: companyId }),
      ]);
      if (cancelled) return;
      const map = new Map<string, Role>();
      ((roles ?? []) as { user_id: string; role: Role }[]).forEach((m) => map.set(m.user_id, m.role));
      setRoleByUser(map);
      setEmployees(((emps ?? []) as Employee[]).map((e) => ({
        ...e,
        role: e.user_id ? (map.get(e.user_id) ?? "employee") : "employee",
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const activeHrUserIds = useMemo(
    () => new Set([...roleByUser.entries()].filter(([, role]) => role === "hr").map(([userId]) => userId)),
    [roleByUser],
  );

  return { employees, loading, activeHrUserIds };
}

/** True only when the employee's creator is still an active HR in this company. */
export function isOwnedByActiveHr(createdBy: string | null, activeHrUserIds: Set<string>) {
  return !!createdBy && activeHrUserIds.has(createdBy);
}

/** Employees with no active-HR creator are shared so they do not disappear. */
export function isSharedEmployee(createdBy: string | null, activeHrUserIds: Set<string>) {
  return !isOwnedByActiveHr(createdBy, activeHrUserIds);
}

/** HR-role queue visibility: own employees plus shared/unassigned employees. */
export function isVisibleToHr(
  employee: { role: Role; created_by: string | null },
  activeHrUserIds: Set<string>,
  hrUserId: string | null,
) {
  return employee.role === "employee"
    && (isSharedEmployee(employee.created_by, activeHrUserIds) || employee.created_by === hrUserId);
}
