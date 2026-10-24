-- VorldX Phase 1: initial schema, constraints, indexes, RLS
-- PDF Sec.5 + Sec.11. UUID PKs, company-scoped uniqueness, hash-only secrets.
-- Apply via Supabase MCP apply_migration. Idempotent guards where safe.

-- extensions (already present on project, keep idempotent)
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- updated_at helper
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- helper: is member / role (SECURITY DEFINER to read memberships under RLS)
create or replace function public.is_company_member(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = _company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.company_role(_company_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.company_memberships m
  where m.company_id = _company_id and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

create or replace function public.is_company_admin(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = _company_id and m.user_id = auth.uid()
      and m.role = 'admin' and m.status = 'active'
  );
$$;

create or replace function public.is_company_hr(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = _company_id and m.user_id = auth.uid()
      and m.role in ('admin','hr') and m.status = 'active'
  );
$$;

-- ================= companies =================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ================= profiles =================
create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ================= memberships =================
create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('admin','hr','employee')),
  status text not null default 'active' check (status in ('active','pending','invited','suspended','deactivated')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists idx_memberships_user on public.company_memberships(user_id);
create index if not exists idx_memberships_company on public.company_memberships(company_id);

-- ================= shifts =================
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  start_time time not null,
  end_time time not null,
  grace_period_minutes int not null default 10 check (grace_period_minutes between 0 and 120),
  working_days int[] not null default '{1,2,3,4,5}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_shifts_company on public.shifts(company_id);

-- ================= employees =================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid,
  employee_code text not null check (char_length(trim(employee_code)) between 1 and 40),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null,
  department text not null default 'General',
  designation text not null default 'Associate',
  joining_date date not null default current_date,
  shift_id uuid references public.shifts(id) on delete set null,
  work_type text not null default 'office' check (work_type in ('office','wfh','hybrid')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_code)
);
create unique index if not exists uq_employees_company_email on public.employees(company_id, lower(email));
create index if not exists idx_employees_company on public.employees(company_id);
create index if not exists idx_employees_user on public.employees(user_id);
drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated before update on public.employees
  for each row execute function public.handle_updated_at();

-- ================= attendance_policies =================
create table if not exists public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  wfh_enabled boolean not null default true,
  wfh_eligibility_rules text not null default '',
  request_cutoff_minutes int not null default 120 check (request_cutoff_minutes between 0 and 1440),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- ================= attendance_records (one per employee per day) =================
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  attendance_type text not null check (attendance_type in ('office','wfh')),
  check_in_at timestamptz not null,
  check_out_at timestamptz check (check_out_at is null or check_out_at > check_in_at),
  status text not null check (status in ('present','late')),
  source text not null default 'qr' check (source in ('qr','passcode','manual','correction','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id, work_date)
);
create index if not exists idx_att_company_date on public.attendance_records(company_id, work_date);
create index if not exists idx_att_employee_date on public.attendance_records(employee_id, work_date);
create index if not exists idx_att_status on public.attendance_records(company_id, status);
create index if not exists idx_att_type on public.attendance_records(company_id, attendance_type);
drop trigger if exists trg_attendance_updated on public.attendance_records;
create trigger trg_attendance_updated before update on public.attendance_records
  for each row execute function public.handle_updated_at();

-- ================= wfh_requests =================
create table if not exists public.wfh_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_date date not null check (request_date >= current_date - interval '1 day'),
  reason text not null check (char_length(trim(reason)) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wfh_company_status_date on public.wfh_requests(company_id, status, request_date);
create index if not exists idx_wfh_employee on public.wfh_requests(employee_id, request_date);
drop trigger if exists trg_wfh_updated on public.wfh_requests;
create trigger trg_wfh_updated before update on public.wfh_requests
  for each row execute function public.handle_updated_at();

-- ================= wfh_passcodes (hash only, single-use) =================
create table if not exists public.wfh_passcodes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  wfh_request_id uuid not null unique references public.wfh_requests(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  passcode_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  generated_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_pass_employee_date on public.wfh_passcodes(employee_id, work_date);

-- ================= qr_displays =================
create table if not exists public.qr_displays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_name text not null,
  office_name text not null default 'HQ',
  is_active boolean not null default true,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists idx_displays_company on public.qr_displays(company_id);

-- ================= qr_sessions (hash only, 18s) =================
create table if not exists public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_id uuid not null references public.qr_displays(id) on delete cascade,
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists idx_qr_display_issued on public.qr_sessions(display_id, issued_at desc);
create index if not exists idx_qr_expiry on public.qr_sessions(expires_at);

-- ================= feedback =================
create table if not exists public.feedback_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subject_employee_id uuid not null references public.employees(id) on delete cascade,
  reviewer_user_id uuid not null,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  comments text not null default '' check (char_length(comments) <= 5000),
  status text not null default 'submitted' check (status in ('draft','submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_feedback_subject on public.feedback_reviews(subject_employee_id, period_start);
create index if not exists idx_feedback_company on public.feedback_reviews(company_id);
drop trigger if exists trg_feedback_updated on public.feedback_reviews;
create trigger trg_feedback_updated before update on public.feedback_reviews
  for each row execute function public.handle_updated_at();

create table if not exists public.feedback_ratings (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.feedback_reviews(id) on delete cascade,
  criterion text not null check (criterion in ('punctuality','attendance_consistency','teamwork_collaboration','adaptability','accountability')),
  score int not null check (score between 0 and 10),
  comments text,
  unique (review_id, criterion)
);

-- ================= audit_logs (append-only) =================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_company on public.audit_logs(company_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);

-- ================= RLS =================
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.attendance_policies enable row level security;
alter table public.attendance_records enable row level security;
alter table public.wfh_requests enable row level security;
alter table public.wfh_passcodes enable row level security;
alter table public.qr_displays enable row level security;
alter table public.qr_sessions enable row level security;
alter table public.feedback_reviews enable row level security;
alter table public.feedback_ratings enable row level security;
alter table public.audit_logs enable row level security;

-- companies: members read, admin update (create via trusted service_role)
drop policy if exists companies_select_member on public.companies;
create policy companies_select_member on public.companies for select
  using (public.is_company_member(id));
drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies for update
  using (public.is_company_admin(id)) with check (public.is_company_admin(id));

-- profiles: own only
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- memberships: own read + admin read; write admin only
drop policy if exists memberships_select on public.company_memberships;
create policy memberships_select on public.company_memberships for select
  using (user_id = auth.uid() or public.is_company_admin(company_id));
drop policy if exists memberships_insert_admin on public.company_memberships;
create policy memberships_insert_admin on public.company_memberships for insert
  with check (public.is_company_admin(company_id));
drop policy if exists memberships_update_admin on public.company_memberships;
create policy memberships_update_admin on public.company_memberships for update
  using (public.is_company_admin(company_id));
-- no delete policy: block hard deletes for app roles

-- employees: admin/hr full read, employee own; write admin/hr only
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select
  using (
    public.is_company_hr(company_id)
    or user_id = auth.uid()
  );
drop policy if exists employees_insert_hr on public.employees;
create policy employees_insert_hr on public.employees for insert
  with check (public.is_company_hr(company_id));
drop policy if exists employees_update_hr on public.employees;
create policy employees_update_hr on public.employees for update
  using (public.is_company_hr(company_id));

-- shifts + policies: members read, admin write
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select using (public.is_company_member(company_id));
drop policy if exists shifts_write_admin on public.shifts;
create policy shifts_write_admin on public.shifts for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

drop policy if exists policies_select on public.attendance_policies;
create policy policies_select on public.attendance_policies for select using (public.is_company_member(company_id));
drop policy if exists policies_write_admin on public.attendance_policies;
create policy policies_write_admin on public.attendance_policies for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

-- attendance: read scoped, writes via privileged functions only (no insert/update/delete policies)
drop policy if exists attendance_select on public.attendance_records;
create policy attendance_select on public.attendance_records for select
  using (
    public.is_company_hr(company_id)
    or exists (
      select 1 from public.employees e
      where e.id = attendance_records.employee_id and e.user_id = auth.uid()
    )
  );

-- wfh_requests: read scoped + own; insert own pending; updates via functions only
drop policy if exists wfh_select on public.wfh_requests;
create policy wfh_select on public.wfh_requests for select
  using (
    public.is_company_hr(company_id)
    or exists (
      select 1 from public.employees e
      where e.id = wfh_requests.employee_id and e.user_id = auth.uid()
    )
  );
drop policy if exists wfh_insert_own on public.wfh_requests;
create policy wfh_insert_own on public.wfh_requests for insert
  with check (
    status = 'pending'
    and public.is_company_member(company_id)
    and exists (
      select 1 from public.employees e
      where e.id = employee_id and e.user_id = auth.uid() and e.company_id = wfh_requests.company_id and e.is_active
    )
  );

-- qr_displays: members read, admin write
drop policy if exists displays_select on public.qr_displays;
create policy displays_select on public.qr_displays for select using (public.is_company_member(company_id));
drop policy if exists displays_write_admin on public.qr_displays;
create policy displays_write_admin on public.qr_displays for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

-- wfh_passcodes + qr_sessions: no app-role policies (deny all; service_role bypasses for Edge Functions)

-- feedback: reviewer + subject + hr/admin scoped read; insert hr/admin only
drop policy if exists feedback_select on public.feedback_reviews;
create policy feedback_select on public.feedback_reviews for select
  using (
    reviewer_user_id = auth.uid()
    or public.is_company_hr(company_id)
    or exists (
      select 1 from public.employees e
      where e.id = feedback_reviews.subject_employee_id and e.user_id = auth.uid()
    )
  );
drop policy if exists feedback_insert_hr on public.feedback_reviews;
create policy feedback_insert_hr on public.feedback_reviews for insert
  with check (public.is_company_hr(company_id));

drop policy if exists ratings_select on public.feedback_ratings;
create policy ratings_select on public.feedback_ratings for select
  using (
    exists (
      select 1 from public.feedback_reviews r
      where r.id = feedback_ratings.review_id
        and (r.reviewer_user_id = auth.uid() or public.is_company_hr(r.company_id)
          or exists (select 1 from public.employees e where e.id = r.subject_employee_id and e.user_id = auth.uid()))
    )
  );
drop policy if exists ratings_insert_hr on public.feedback_ratings;
create policy ratings_insert_hr on public.feedback_ratings for insert
  with check (
    exists (
      select 1 from public.feedback_reviews r
      where r.id = review_id and public.is_company_hr(r.company_id)
    )
  );

-- audit_logs: admin read only; writes via service_role
drop policy if exists audit_select_admin on public.audit_logs;
create policy audit_select_admin on public.audit_logs for select
  using (company_id is not null and public.is_company_admin(company_id));
