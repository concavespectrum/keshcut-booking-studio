alter table public.bookings add column custom_service text check (char_length(custom_service) between 1 and 500);
create table public.admin_verified_sessions(session_id uuid primary key, user_id uuid not null, expires_at timestamptz not null);
grant select on public.admin_verified_sessions to authenticated;
grant all on public.admin_verified_sessions to service_role;
alter table public.admin_verified_sessions enable row level security;
create policy "own verified session" on public.admin_verified_sessions for select to authenticated using (user_id=auth.uid());
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.admin_allowlist a join public.admin_verified_sessions s on s.user_id=auth.uid()
where a.email=lower(coalesce(auth.jwt()->>'email','')) and a.phone is not null
and s.session_id::text=auth.jwt()->>'session_id' and s.expires_at>now())
$$;
create or replace function public.kc_custom_detail(p_services smallint[], p_custom text) returns text language plpgsql immutable set search_path=public as $$
begin
 if 13=any(p_services) then
  if p_custom is null or char_length(btrim(p_custom)) not between 1 and 500 then raise exception 'invalid_custom_service'; end if;
  return btrim(p_custom);
 end if;
 return null;
end $$;
create or replace function public.kc_create_booking_details(p_hash bytea,p_new_hash bytea,p_name text,p_phone text,p_services smallint[],p_start timestamptz,p_custom text) returns jsonb language plpgsql security definer set search_path=public as $$
declare detail text; result jsonb;
begin
 detail:=public.kc_custom_detail(p_services,p_custom);
 result:=public.kc_create_booking(p_hash,p_new_hash,p_name,p_phone,p_services,p_start);
 update public.bookings set custom_service=detail where ticket_id=result->>'ticket_id';
 return result;
end $$;
create or replace function public.kc_update_service_details(p_hash bytea,p_ticket text,p_services smallint[],p_custom text) returns jsonb language plpgsql security definer set search_path=public as $$
declare detail text; result jsonb;
begin
 detail:=public.kc_custom_detail(p_services,p_custom);
 result:=public.kc_update_services(p_hash,p_ticket,p_services);
 update public.bookings set custom_service=detail where ticket_id=p_ticket;
 return result;
end $$;
create or replace function public.kc_me(p_hash bytea) returns jsonb language sql stable security definer set search_path=public as $$
  with s as (select * from public.customer_sessions where token_hash=p_hash and not revoked)
  select jsonb_build_object(
    'name', coalesce(s.display_name, c.name), 'phone', c.phone, 'channel', s.channel_key,
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('ticket_id',b.ticket_id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,
        'custom_service',b.custom_service,'total_price_npr',b.total_price_npr,'services',(select jsonb_agg(jsonb_build_object('id',bs.service_id,'name',bs.name)) from public.booking_services bs where bs.booking_id=b.id))
        order by b.starts_at desc) from (select * from public.bookings where session_id=s.id order by starts_at desc limit 20) b),'[]'::jsonb))
  from s join public.customers c on c.id=s.customer_id
$$;
create or replace function public.kc_admin_delete_ticket(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings;
begin
 if not public.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into b from public.bookings where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 delete from public.bookings where id=p_id;
 if b.status='completed' then update public.customers set visit_count=greatest(visit_count-1,0) where id=b.customer_id; end if;
 update public.customers set last_booking_at=(select max(created_at) from public.bookings where customer_id=b.customer_id) where id=b.customer_id;
 perform public.kc_ping(b.session_id,'booking');
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.kc_admin_delete_ticket(uuid) from public,anon;
grant execute on function public.kc_admin_delete_ticket(uuid) to authenticated;
revoke all on function public.kc_custom_detail(smallint[],text),public.kc_create_booking_details(bytea,bytea,text,text,smallint[],timestamptz,text),public.kc_update_service_details(bytea,text,smallint[],text) from public,anon,authenticated;
grant execute on function public.kc_custom_detail(smallint[],text),public.kc_create_booking_details(bytea,bytea,text,text,smallint[],timestamptz,text),public.kc_update_service_details(bytea,text,smallint[],text) to service_role;