-- VorldX 001c: feedback, audit, RLS + policies (PDF Sec.11)
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

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member on public.companies for select using (public.is_company_member(id));
drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies for update using (public.is_company_admin(id)) with check (public.is_company_admin(id));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

drop policy if exists memberships_select on public.company_memberships;
create policy memberships_select on public.company_memberships for select using (user_id = auth.uid() or public.is_company_admin(company_id));
drop policy if exists memberships_insert_admin on public.company_memberships;
create policy memberships_insert_admin on public.company_memberships for insert with check (public.is_company_admin(company_id));
drop policy if exists memberships_update_admin on public.company_memberships;
create policy memberships_update_admin on public.company_memberships for update using (public.is_company_admin(company_id));

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select using (public.is_company_hr(company_id) or user_id = auth.uid());
drop policy if exists employees_insert_hr on public.employees;
create policy employees_insert_hr on public.employees for insert with check (public.is_company_hr(company_id));
drop policy if exists employees_update_hr on public.employees;
create policy employees_update_hr on public.employees for update using (public.is_company_hr(company_id));

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select using (public.is_company_member(company_id));
drop policy if exists shifts_write_admin on public.shifts;
create policy shifts_write_admin on public.shifts for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

drop policy if exists policies_select on public.attendance_policies;
create policy policies_select on public.attendance_policies for select using (public.is_company_member(company_id));
drop policy if exists policies_write_admin on public.attendance_policies;
create policy policies_write_admin on public.attendance_policies for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

drop policy if exists attendance_select on public.attendance_records;
create policy attendance_select on public.attendance_records for select using (
  public.is_company_hr(company_id)
  or exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.user_id = auth.uid())
);

drop policy if exists wfh_select on public.wfh_requests;
create policy wfh_select on public.wfh_requests for select using (
  public.is_company_hr(company_id)
  or exists (select 1 from public.employees e where e.id = wfh_requests.employee_id and e.user_id = auth.uid())
);
drop policy if exists wfh_insert_own on public.wfh_requests;
create policy wfh_insert_own on public.wfh_requests for insert with check (
  status = 'pending' and public.is_company_member(company_id)
  and exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid() and e.company_id = wfh_requests.company_id and e.is_active)
);

drop policy if exists displays_select on public.qr_displays;
create policy displays_select on public.qr_displays for select using (public.is_company_member(company_id));
drop policy if exists displays_write_admin on public.qr_displays;
create policy displays_write_admin on public.qr_displays for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

drop policy if exists feedback_select on public.feedback_reviews;
create policy feedback_select on public.feedback_reviews for select using (
  reviewer_user_id = auth.uid() or public.is_company_hr(company_id)
  or exists (select 1 from public.employees e where e.id = feedback_reviews.subject_employee_id and e.user_id = auth.uid())
);
drop policy if exists feedback_insert_hr on public.feedback_reviews;
create policy feedback_insert_hr on public.feedback_reviews for insert with check (public.is_company_hr(company_id));

drop policy if exists ratings_select on public.feedback_ratings;
create policy ratings_select on public.feedback_ratings for select using (
  exists (select 1 from public.feedback_reviews r where r.id = feedback_ratings.review_id
    and (r.reviewer_user_id = auth.uid() or public.is_company_hr(r.company_id)
      or exists (select 1 from public.employees e where e.id = r.subject_employee_id and e.user_id = auth.uid())))
);
drop policy if exists ratings_insert_hr on public.feedback_ratings;
create policy ratings_insert_hr on public.feedback_ratings for insert with check (
  exists (select 1 from public.feedback_reviews r where r.id = review_id and public.is_company_hr(r.company_id))
);

drop policy if exists audit_select_admin on public.audit_logs;
create policy audit_select_admin on public.audit_logs for select using (company_id is not null and public.is_company_admin(company_id));
-- no insert/update/delete policies for wfh_passcodes, qr_sessions, audit_logs: service_role only (Edge Functions)
