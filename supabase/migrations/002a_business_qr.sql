-- VorldX 002a: privileged business functions (company bootstrap, QR, office attendance)
-- All SECURITY DEFINER, called by Edge Functions with service_role. Audit logged.

-- bootstrap company + admin (called after Auth user created)
create or replace function public.create_company_with_admin(
  p_user_id uuid, p_company_name text, p_slug text, p_timezone text, p_admin_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_company_id uuid;
declare v_shift_id uuid;
begin
  if char_length(trim(p_company_name)) < 2 then raise exception 'INVALID_COMPANY_NAME'; end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG'; end if;
  insert into public.companies (name, slug, timezone) values (trim(p_company_name), lower(trim(p_slug)), coalesce(nullif(trim(p_timezone),''),'Asia/Kolkata'))
    returning id into v_company_id;
  insert into public.profiles (id, full_name) values (p_user_id, trim(p_admin_name))
    on conflict (id) do update set full_name = excluded.full_name, updated_at = now();
  insert into public.company_memberships (company_id, user_id, role, status)
    values (v_company_id, p_user_id, 'admin', 'active');
  insert into public.shifts (company_id, name, start_time, end_time, grace_period_minutes, working_days)
    values (v_company_id, 'Day Shift', '09:00', '18:00', 10, '{1,2,3,4,5}')
    returning id into v_shift_id;
  insert into public.attendance_policies (company_id, wfh_enabled, request_cutoff_minutes, updated_by)
    values (v_company_id, true, 120, p_user_id);
  -- admin also gets an employee row for own attendance/feedback
  insert into public.employees (company_id, user_id, employee_code, full_name, email, department, designation, shift_id)
    values (v_company_id, p_user_id, 'ADM-001', trim(p_admin_name), '', 'Administration', 'Admin', v_shift_id);
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_company_id, p_user_id, 'company.created', 'company', v_company_id::text, jsonb_build_object('name', p_company_name, 'slug', p_slug));
  return v_company_id;
end; $$;

-- issue QR session (token generated + hashed in Edge Function, hash stored only)
create or replace function public.issue_qr_session(
  p_display_id uuid, p_token_hash text, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_company_id uuid; v_sid uuid;
begin
  if char_length(p_token_hash) < 16 then raise exception 'INVALID_TOKEN_HASH'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '60 seconds' then raise exception 'INVALID_EXPIRY'; end if;
  select company_id into v_company_id from public.qr_displays where id = p_display_id and is_active;
  if not found then raise exception 'DISPLAY_DISABLED'; end if;
  insert into public.qr_sessions (company_id, display_id, token_hash, expires_at)
    values (v_company_id, p_display_id, p_token_hash, p_expires_at) returning id into v_sid;
  update public.qr_displays set last_seen_at = now() where id = p_display_id;
  return v_sid;
end; $$;

-- office attendance via QR: first scan = check-in, second = check-out, third+ = reject
create or replace function public.process_office_attendance(
  p_token_hash text, p_employee_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sess record; v_emp record; v_comp record; v_shift record;
  v_now timestamptz := now();
  v_work_date date; v_local_time time; v_status text; v_rec record;
begin
  select s.*, d.is_active as display_active into v_sess
    from public.qr_sessions s join public.qr_displays d on d.id = s.display_id
    where s.token_hash = p_token_hash and s.revoked_at is null limit 1;
  if not found then raise exception 'QR_INVALID'; end if;
  if v_sess.expires_at <= v_now then raise exception 'QR_EXPIRED'; end if;
  if not v_sess.display_active then raise exception 'DISPLAY_DISABLED'; end if;

  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  if v_emp.user_id is null then raise exception 'NOT_ACTIVATED'; end if;
  if v_emp.company_id != v_sess.company_id then raise exception 'COMPANY_MISMATCH'; end if;

  select * into v_comp from public.companies where id = v_emp.company_id and is_active;
  if not found then raise exception 'COMPANY_INACTIVE'; end if;

  -- membership must be active (employee, hr, or admin can mark own attendance)
  if not exists (select 1 from public.company_memberships m
      where m.company_id = v_emp.company_id and m.user_id = v_emp.user_id and m.status = 'active') then
    raise exception 'MEMBERSHIP_INACTIVE';
  end if;

  v_work_date := ((v_now at time zone v_comp.timezone))::date;
  v_local_time := ((v_now at time zone v_comp.timezone))::time;

  select * into v_shift from public.shifts where id = v_emp.shift_id and is_active;
  if found then
    if v_local_time <= (v_shift.start_time + (v_shift.grace_period_minutes || ' minutes')::interval) then v_status := 'present';
    else v_status := 'late'; end if;
  else v_status := 'present'; end if;

  -- lock daily row if exists
  select * into v_rec from public.attendance_records
    where company_id = v_emp.company_id and employee_id = v_emp.id and work_date = v_work_date for update;
  if not found then
    insert into public.attendance_records (company_id, employee_id, work_date, attendance_type, check_in_at, status, source)
      values (v_emp.company_id, v_emp.id, v_work_date, 'office', v_now, v_status, 'qr')
      returning * into v_rec;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
      values (v_emp.company_id, v_emp.user_id, 'attendance.checkin', 'attendance_record', v_rec.id::text,
        jsonb_build_object('type','office','work_date',v_work_date,'status',v_status));
  elsif v_rec.check_out_at is null then
    if v_rec.attendance_type != 'office' then raise exception 'TYPE_CONFLICT'; end if;
    update public.attendance_records set check_out_at = v_now, updated_at = v_now where id = v_rec.id returning * into v_rec;
    insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
      values (v_emp.company_id, v_emp.user_id, 'attendance.checkout', 'attendance_record', v_rec.id::text,
        jsonb_build_object('check_out_at', v_now));
  else
    raise exception 'ALREADY_CHECKED_OUT';
  end if;

  return jsonb_build_object('id', v_rec.id, 'work_date', v_rec.work_date, 'type', v_rec.attendance_type,
    'check_in_at', v_rec.check_in_at, 'check_out_at', v_rec.check_out_at, 'status', v_rec.status);
end; $$;

-- explicit checkout (office or WFH) without QR
create or replace function public.checkout_attendance(p_employee_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emp record; v_comp record; v_now timestamptz := now(); v_wd date; v_rec record;
begin
  select * into v_emp from public.employees where id = p_employee_id and is_active;
  if not found then raise exception 'EMPLOYEE_INACTIVE'; end if;
  select * into v_comp from public.companies where id = v_emp.company_id;
  v_wd := ((v_now at time zone coalesce(v_comp.timezone,'Asia/Kolkata')))::date;
  select * into v_rec from public.attendance_records
    where company_id = v_emp.company_id and employee_id = v_emp.id and work_date = v_wd for update;
  if not found then raise exception 'NO_CHECKIN'; end if;
  if v_rec.check_out_at is not null then raise exception 'ALREADY_CHECKED_OUT'; end if;
  update public.attendance_records set check_out_at = v_now where id = v_rec.id returning * into v_rec;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (v_emp.company_id, v_emp.user_id, 'attendance.checkout', 'attendance_record', v_rec.id::text,
      jsonb_build_object('check_out_at', v_now, 'source', v_rec.source));
  return jsonb_build_object('id', v_rec.id, 'check_out_at', v_rec.check_out_at);
end; $$;
