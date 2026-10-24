-- 007_zombie_cleanup.sql
-- Garbage-collects abandoned company signups ("zombie companies").
--
-- A signup is COMPLETE the moment any member's email is confirmed
-- (auth.users.email_confirmed_at is set). Such companies are never touched.
--
-- A signup is INCOMPLETE when the company is older than the grace period and
-- no member has ever confirmed their email. Those are deleted together with
-- their unconfirmed auth users, freeing both the slug and the email address.
--
-- Safety:
--   * p_dry_run defaults to TRUE - a manual call only reports, never deletes.
--   * Companies with any attendance / WFH / leave / feedback activity are skipped.
--   * An auth user shared with another company is never deleted.
--   * Execute is revoked from public/anon/authenticated (service_role only).

create or replace function public.cleanup_unconfirmed_signups(
  p_dry_run boolean default true,
  p_grace_hours integer default 48
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
  v_cutoff timestamptz := now() - make_interval(hours => greatest(coalesce(p_grace_hours, 48), 1));
  v_out jsonb := '[]'::jsonb;
  v_users uuid[];
  v_uid uuid;
begin
  for r in
    select c.id, c.slug, c.name, c.created_at
    from public.companies c
    where c.created_at < v_cutoff
      -- no member of this company has ever confirmed their email
      and not exists (
        select 1
        from public.company_memberships m
        join auth.users u on u.id = m.user_id
        where m.company_id = c.id
          and u.email_confirmed_at is not null
      )
      -- belt and braces: never touch a company with real activity
      and not exists (select 1 from public.attendance_records a where a.company_id = c.id)
      and not exists (select 1 from public.wfh_requests w where w.company_id = c.id)
      and not exists (select 1 from public.leave_requests l where l.company_id = c.id)
      and not exists (select 1 from public.feedback_reviews f where f.company_id = c.id)
    order by c.created_at
  loop
    -- unconfirmed users who belong ONLY to this company
    select coalesce(array_agg(m.user_id), '{}')
      into v_users
    from public.company_memberships m
    join auth.users u on u.id = m.user_id
    where m.company_id = r.id
      and u.email_confirmed_at is null
      and not exists (
        select 1 from public.company_memberships m2
        where m2.user_id = m.user_id
          and m2.company_id <> r.id
      );

    if p_dry_run then
      v_out := v_out || jsonb_build_object(
        'company_id', r.id,
        'slug', r.slug,
        'name', r.name,
        'created_at', r.created_at,
        'orphan_users', coalesce(array_length(v_users, 1), 0),
        'dry_run', true
      );
      continue;
    end if;

    -- company delete cascades memberships, employees, attendance, WFH, leave,
    -- feedback, QR displays/sessions, policies, shifts and audit logs.
    delete from public.companies where id = r.id;

    foreach v_uid in array v_users loop
      delete from public.profiles where id = v_uid;
      delete from auth.users where id = v_uid;  -- cascades auth.identities/sessions/tokens
    end loop;

    v_out := v_out || jsonb_build_object(
      'company_id', r.id,
      'slug', r.slug,
      'name', r.name,
      'deleted_users', coalesce(array_length(v_users, 1), 0),
      'dry_run', false
    );
  end loop;

  return v_out;
end;
$$;

comment on function public.cleanup_unconfirmed_signups(boolean, integer) is
  'Deletes company signups older than p_grace_hours whose members never confirmed their email. p_dry_run=true only reports.';

revoke all on function public.cleanup_unconfirmed_signups(boolean, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_unconfirmed_signups(boolean, integer)
  to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Daily schedule (pg_cron). Safe to re-run: cron.schedule updates by name.
-- Fallback if pg_cron is unavailable: call the function manually with
--   select public.cleanup_unconfirmed_signups(false);
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'vorldx-cleanup-unconfirmed-signups',
  '0 3 * * *',
  $$select public.cleanup_unconfirmed_signups(false);$$
);
