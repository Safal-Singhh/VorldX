-- VorldX 006b: QR device secret — a display id alone must never authorize token minting.
-- Each paired display now carries its own device secret. The office PC keeps the raw secret
-- (localStorage); the server stores only its SHA-256 hash. issue-office-qr must present the
-- secret before a QR session is minted, so a leaked display URL/UUID is useless on its own.

alter table public.qr_displays add column if not exists device_secret_hash text;

-- replace the 3-arg minter with the device-bound 4-arg version (old signature dropped)
drop function if exists public.issue_qr_session(uuid, text, timestamptz);

create or replace function public.issue_qr_session(
  p_display_id uuid, p_token_hash text, p_device_secret_hash text, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_company_id uuid; v_secret text; v_sid uuid;
begin
  if char_length(p_token_hash) < 16 then raise exception 'INVALID_TOKEN_HASH'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '60 seconds' then raise exception 'INVALID_EXPIRY'; end if;
  select company_id, device_secret_hash into v_company_id, v_secret
    from public.qr_displays where id = p_display_id and is_active;
  if not found then raise exception 'DISPLAY_DISABLED'; end if;
  if v_secret is null then raise exception 'DEVICE_KEY_REQUIRED'; end if;
  if p_device_secret_hash is null or v_secret <> p_device_secret_hash then raise exception 'DEVICE_KEY_INVALID'; end if;
  -- anti-spam: the kiosk rotates every 18s; reject bursts faster than one mint per 5s per display
  if exists (select 1 from public.qr_sessions where display_id = p_display_id and issued_at > now() - interval '5 seconds') then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.qr_sessions (company_id, display_id, token_hash, expires_at)
    values (v_company_id, p_display_id, p_token_hash, p_expires_at) returning id into v_sid;
  update public.qr_displays set last_seen_at = now() where id = p_display_id;
  return v_sid;
end; $$;

-- server-only, same posture as 006a (service_role keeps its explicit grant)
revoke execute on function public.issue_qr_session(uuid, text, text, timestamptz) from public, anon, authenticated;
