-- VorldX 005b: company role map (HR cannot read other membership rows via RLS,
-- so role classification must go through this scoped SECURITY DEFINER function).
create or replace function public.company_role_map(p_company_id uuid)
returns table (user_id uuid, role text)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role from public.company_memberships m
  where m.company_id = p_company_id
    and m.status = 'active'
    and exists (
      select 1 from public.company_memberships me
      where me.company_id = p_company_id and me.user_id = auth.uid() and me.status = 'active'
    );
$$;
