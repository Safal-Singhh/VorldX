-- VorldX seed: FICTIONAL demo data only. No real PII.
-- Run AFTER creating demo Auth users via dashboard or signup flow.
-- Replace placeholder UUIDs with real auth.users ids from your demo signups.
-- Demo company: VorldX Demo Pvt Ltd (slug: vorldx-demo)

-- Usage (psql / SQL editor with service_role bypass):
-- 1. Create demo users in Auth: admin@vorldx.demo, hr@vorldx.demo, emp1@vorldx.demo
-- 2. Copy their auth.users ids below, then run this file.

-- Placeholder IDs (replace):
-- admin: 11111111-1111-1111-1111-111111111111
-- hr:    22222222-2222-2222-2222-222222222222
-- emp1:  33333333-3333-3333-3333-333333333333

do $$
declare
  v_admin uuid := '11111111-1111-1111-1111-111111111111';
  v_hr uuid := '22222222-2222-2222-2222-222222222222';
  v_emp uuid := '33333333-3333-3333-3333-333333333333';
  v_company uuid;
  v_shift uuid;
  v_emp_hr uuid;
  v_emp_e1 uuid;
begin
  -- company via privileged bootstrap (admin user must already exist in auth.users)
  -- If company already seeded, skip: check slug
  select id into v_company from public.companies where slug = 'vorldx-demo';
  if not found then
    v_company := public.create_company_with_admin(v_admin, 'VorldX Demo Pvt Ltd', 'vorldx-demo', 'Asia/Kolkata', 'Aarav Demo Admin');
  end if;

  select id into v_shift from public.shifts where company_id = v_company limit 1;

  -- profiles for hr/employee (admin profile created by bootstrap)
  insert into public.profiles (id, full_name) values
    (v_hr, 'Diya Demo HR'),
    (v_emp, 'Kabir Demo Employee')
  on conflict (id) do update set full_name = excluded.full_name;

  -- memberships
  insert into public.company_memberships (company_id, user_id, role, status) values
    (v_company, v_hr, 'hr', 'active'),
    (v_company, v_emp, 'employee', 'active')
  on conflict (company_id, user_id) do update set role = excluded.role, status = 'active';

  -- employee rows
  insert into public.employees (company_id, user_id, employee_code, full_name, email, department, designation, shift_id, created_by) values
    (v_company, v_hr, 'HR-001', 'Diya Demo HR', 'hr@vorldx.demo', 'People Ops', 'HR Executive', v_shift, v_admin),
    (v_company, v_emp, 'EMP-001', 'Kabir Demo Employee', 'emp1@vorldx.demo', 'Engineering', 'Associate', v_shift, v_hr)
  on conflict (company_id, employee_code) do update set user_id = excluded.user_id, full_name = excluded.full_name, created_by = excluded.created_by;

  -- QR display
  insert into public.qr_displays (company_id, display_name, office_name, is_active)
    values (v_company, 'HQ Lobby Display', 'HQ', true)
  on conflict do nothing;
end $$;
