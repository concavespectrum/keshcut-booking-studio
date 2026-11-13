alter table public.admin_verified_sessions add column issued_at bigint;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.admin_allowlist a join public.admin_verified_sessions s on s.user_id=auth.uid()
where a.email=lower(coalesce(auth.jwt()->>'email','')) and a.phone is not null and s.expires_at>now()
and (case when auth.jwt()->>'session_id' is not null then s.session_id::text=auth.jwt()->>'session_id'
else s.issued_at=(auth.jwt()->>'iat')::bigint end))
$$;