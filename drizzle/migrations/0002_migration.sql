alter table public.customer_sessions add column display_name text;
create or replace function public.kc_ensure_session(p_hash bytea, p_new_hash bytea, p_name text, p_phone text)
returns public.customer_sessions language plpgsql security definer set search_path=public as $$
declare s public.customer_sessions; ph text := public.kc_norm_phone(p_phone); nm text := btrim(coalesce(p_name,'')); cid uuid;
begin
  if p_hash is not null then
    select * into s from public.customer_sessions where token_hash=p_hash and not revoked;
    if found then
      update public.customer_sessions set last_seen=now() where id=s.id and last_seen < now()-interval '1 hour';
      return s;
    end if;
  end if;
  if ph is null then raise exception 'invalid_phone'; end if;
  if char_length(nm) not between 1 and 80 then raise exception 'invalid_name'; end if;
  if p_new_hash is null then raise exception 'no_session'; end if;
  insert into public.customers(phone,name) values(ph,nm) on conflict(phone) do update set phone=excluded.phone returning id into cid;
  insert into public.customer_sessions(customer_id,token_hash,display_name) values(cid,p_new_hash,nm) returning * into s;
  return s;
end $$;
-- A session only sees the name it was created with, never another device's data.
create or replace function public.kc_me(p_hash bytea) returns jsonb language sql stable security definer set search_path=public as $$
  with s as (select * from public.customer_sessions where token_hash=p_hash and not revoked)
  select jsonb_build_object(
    'name', coalesce(s.display_name, c.name), 'phone', c.phone, 'channel', s.channel_key,
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('ticket_id',b.ticket_id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,
        'total_price_npr',b.total_price_npr,'services',(select jsonb_agg(jsonb_build_object('id',bs.service_id,'name',bs.name)) from public.booking_services bs where bs.booking_id=b.id))
        order by b.starts_at desc) from (select * from public.bookings where session_id=s.id order by starts_at desc limit 20) b),'[]'::jsonb))
  from s join public.customers c on c.id=s.customer_id
$$;
revoke all on function public.kc_me(bytea) from public, anon, authenticated;
revoke all on function public.kc_ensure_session(bytea,bytea,text,text) from public, anon, authenticated;
grant execute on function public.kc_me(bytea), public.kc_ensure_session(bytea,bytea,text,text) to service_role;