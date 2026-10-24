-- VorldX 002e: feedback + audited corrections (PDF Sec.9)
create or replace function public.submit_feedback(
  p_company_id uuid, p_subject_employee_id uuid, p_reviewer_user_id uuid,
  p_period_start date, p_period_end date, p_comments text,
  p_scores jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_sub record; v_rev_role text; v_sub_role text; v_rid uuid; r record;
declare v_allowed text[] := array['punctuality','attendance_consistency','teamwork_collaboration','adaptability','accountability'];
declare k text; v int;
begin
  if p_period_end < p_period_start then raise exception 'INVALID_PERIOD'; end if;
  if char_length(coalesce(p_comments,'')) > 5000 then raise exception 'COMMENTS_TOO_LONG'; end if;
  select * into v_sub from public.employees where id = p_subject_employee_id and company_id = p_company_id and is_active;
  if not found then raise exception 'SUBJECT_INVALID'; end if;
  select role into v_rev_role from public.company_memberships where company_id = p_company_id and user_id = p_reviewer_user_id and status='active';
  if not found then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  select role into v_sub_role from public.company_memberships where company_id = p_company_id and user_id = v_sub.user_id and status='active';
  if v_sub_role is null then v_sub_role := 'employee'; end if;
  -- HR reviews employee, Admin reviews HR
  if v_rev_role = 'hr' and v_sub_role != 'employee' then raise exception 'HR_CAN_REVIEW_EMPLOYEE_ONLY'; end if;
  if v_rev_role = 'admin' and v_sub_role != 'hr' then
    -- allow admin to review hr; also allow admin reviewing employee? Spec says Admin reviews HR. Enforce hr only, but allow employee if no hr? Strict: hr only.
    if v_sub_role not in ('hr') then raise exception 'ADMIN_CAN_REVIEW_HR_ONLY'; end if;
  end if;
  if v_rev_role = 'employee' then raise exception 'REVIEWER_UNAUTHORIZED'; end if;
  if v_sub.user_id = p_reviewer_user_id then raise exception 'SELF_REVIEW'; end if;
  if jsonb_typeof(p_scores) != 'object' then raise exception 'INVALID_SCORES'; end if;
  insert into public.feedback_reviews (company_id, subject_employee_id, reviewer_user_id, period_start, period_end, comments, status)
    values (p_company_id, p_subject_employee_id, p_reviewer_user_id, p_period_start, p_period_end, coalesce(p_comments,''), 'submitted')
    returning id into v_rid;
  for r in select * from jsonb_each(p_scores) loop
    k := r.key; v := (r.value)::int;
    if not (k = any(v_allowed)) then raise exception 'INVALID_CRITERION %', k; end if;
    if v < 0 or v > 10 then raise exception 'SCORE_OUT_OF_RANGE'; end if;
    insert into public.feedback_ratings (review_id, criterion, score) values (v_rid, k, v);
  end loop;
  if (select count(*) from public.feedback_ratings where review_id = v_rid) = 0 then raise exception 'NO_SCORES'; end if;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (p_company_id, p_reviewer_user_id, 'feedback.submitted', 'feedback_review', v_rid::text, jsonb_build_object('subject', p_subject_employee_id));
  return v_rid;
end; $$;

-- audited attendance correction (admin/hr only, reason required)
create or replace function public.admin_correct_attendance(
  p_record_id uuid, p_actor_user_id uuid, p_check_in timestamptz, p_check_out timestamptz, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare v_rec record; v_role text;
begin
  if char_length(trim(coalesce(p_reason,''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  if p_check_out is not null and p_check_out <= p_check_in then raise exception 'INVALID_TIMES'; end if;
  select * into v_rec from public.attendance_records where id = p_record_id for update;
  if not found then raise exception 'RECORD_NOT_FOUND'; end if;
  select role into v_role from public.company_memberships where company_id = v_rec.company_id and user_id = p_actor_user_id and status='active';
  if not found or v_role not in ('admin','hr') then raise exception 'CORRECTION_UNAUTHORIZED'; end if;
  update public.attendance_records set check_in_at = p_check_in, check_out_at = p_check_out, source = 'correction' where id = p_record_id;
  insert into public.audit_logs (company_id, actor_user_id, action, entity_type, entity_id, old_values, new_values)
    values (v_rec.company_id, p_actor_user_id, 'attendance.corrected', 'attendance_record', p_record_id::text,
      jsonb_build_object('check_in_at', v_rec.check_in_at, 'check_out_at', v_rec.check_out_at),
      jsonb_build_object('check_in_at', p_check_in, 'check_out_at', p_check_out, 'reason', p_reason));
end; $$;
