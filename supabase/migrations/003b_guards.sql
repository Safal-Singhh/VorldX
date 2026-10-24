-- VorldX 003b: HR guardrails (HR can only edit employee rows) + auto employee code
-- HR update allowed only when target row is NOT an active admin/hr member (or actor is admin).

drop policy if exists employees_update_hr on public.employees;
create policy employees_update_hr on public.employees for update
  using (
    public.is_company_hr(company_id)
    and (
      public.is_company_admin(company_id)
      or user_id is null
      or not exists (
        select 1 from public.company_memberships m
        where m.company_id = employees.company_id
          and m.user_id = employees.user_id
          and m.status = 'active'
          and m.role in ('admin','hr')
      )
    )
  )
  with check (
    public.is_company_hr(company_id)
    and (
      public.is_company_admin(company_id)
      or user_id is null
      or not exists (
        select 1 from public.company_memberships m
        where m.company_id = employees.company_id
          and m.user_id = employees.user_id
          and m.status = 'active'
          and m.role in ('admin','hr')
      )
    )
  );

-- server-side unique employee code generator (EMP-XXXXXX with retry)
create or replace function public.next_employee_code(
  p_company_id uuid, p_prefix text default 'EMP'
) returns text language plpgsql security definer set search_path = public as $$
declare v text; i int := 0;
begin
  loop
    v := p_prefix || '-' || lpad(((floor(random() * 900000) + 100000))::int::text, 6, '0');
    exit when not exists (select 1 from public.employees where company_id = p_company_id and employee_code = v);
    i := i + 1;
    if i > 50 then raise exception 'CODE_GENERATION_FAILED'; end if;
  end loop;
  return v;
end; $$;
