create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ===== reference data =====
create table public.services(
  id smallint primary key, name text not null unique, duration_min int not null check (duration_min between 5 and 480),
  price_npr int check (price_npr >= 0), bookable boolean not null default true, sort smallint not null default 0);
grant select on public.services to anon, authenticated; grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "services public read" on public.services for select to anon, authenticated using (true);
insert into public.services(id,name,duration_min,sort) values
(1,'Haircut & Modern Hairstyles',30,1),(2,'Beard Trimming & Styling',20,2),(3,'Hair Coloring & Highlights',90,3),
(4,'Hair Perming',120,4),(5,'Dreadlocks (Locs) Styling',180,5),(6,'Hair Washing & Cleansing',15,6),
(7,'Facial Treatments',45,7),(8,'Hair & Scalp Care',30,8),(9,'Hair Styling & Blow Dry',30,9),(10,'Professional Grooming',60,10);

create table public.admin_allowlist(email text primary key, phone text, label text not null);
grant all on public.admin_allowlist to service_role;
alter table public.admin_allowlist enable row level security;
insert into public.admin_allowlist values
('samundrakharel2020@gmail.com','9769232638','Web Developer'),
('keshcutstudio@gmail.com',null,'Barbershop Owner / Manager');

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_allowlist a where a.email = lower(coalesce(auth.jwt()->>'email','')) and a.phone is not null)
$$;
revoke all on function public.is_admin() from public, anon; grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.kc_norm_phone(p text) returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p,''),'\D','','g');
begin
  if d like '00%' then d := substr(d,3); end if;
  if length(d)=13 and d like '977%' then d := substr(d,4); end if;
  if length(d)=11 and d like '0%' then d := substr(d,2); end if;
  if d !~ '^9[678]\d{8}$' then return null; end if;
  return d;
end $$;

-- ===== customers & sessions =====
create table public.customers(
  id uuid primary key default gen_random_uuid(), phone text not null unique check (phone ~ '^9[678]\d{8}$'),
  name text not null, visit_count int not null default 0, created_at timestamptz not null default now(), last_booking_at timestamptz);
create table public.customer_sessions(
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash bytea not null unique, channel_key text not null unique default encode(gen_random_bytes(18),'hex'),
  created_at timestamptz not null default now(), last_seen timestamptz not null default now(), revoked boolean not null default false);
create index on public.customer_sessions(customer_id);

-- ===== bookings =====
create table public.bookings(
  id uuid primary key default gen_random_uuid(), ticket_id text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null references public.customer_sessions(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled','no_show')),
  total_price_npr int, admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint bookings_no_overlap exclude using gist (tstzrange(starts_at,ends_at) with &&) where (status in ('pending','confirmed')));
create index on public.bookings(customer_id, starts_at desc);
create index on public.bookings(session_id);
create index on public.bookings(starts_at);
create table public.booking_services(
  booking_id uuid not null references public.bookings(id) on delete cascade, service_id smallint not null references public.services(id),
  name text not null, duration_min int not null, price_npr int, primary key(booking_id, service_id));

-- ===== conversations =====
create table public.conversations(
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid not null unique references public.customer_sessions(id) on delete cascade,
  created_at timestamptz not null default now(), last_message_at timestamptz not null default now(), unread_admin int not null default 0);
create index on public.conversations(last_message_at desc);
create index on public.conversations(customer_id);
create table public.messages(
  id bigint generated always as identity primary key, conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('customer','admin')), body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now());
create index on public.messages(conversation_id, id);

-- grants: customers never touch tables directly (server-side RPC only); admins read via RLS
grant select on public.customers, public.bookings, public.booking_services, public.conversations, public.messages to authenticated;
grant update (status, admin_note) on public.bookings to authenticated;
grant update (unread_admin) on public.conversations to authenticated;
grant insert (conversation_id, sender, body) on public.messages to authenticated;
grant all on public.customers, public.customer_sessions, public.bookings, public.booking_services, public.conversations, public.messages to service_role;
alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_services enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy "admin read customers" on public.customers for select to authenticated using (public.is_admin());
create policy "admin read bookings" on public.bookings for select to authenticated using (public.is_admin());
create policy "admin update bookings" on public.bookings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read booking services" on public.booking_services for select to authenticated using (public.is_admin());
create policy "admin read conversations" on public.conversations for select to authenticated using (public.is_admin());
create policy "admin update conversations" on public.conversations for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read messages" on public.messages for select to authenticated using (public.is_admin());
create policy "admin reply" on public.messages for insert to authenticated with check (public.is_admin() and sender='admin');

-- ===== triggers =====
create or replace function public.kc_ping(p_session uuid, p_kind text) returns void language plpgsql security definer set search_path=public as $$
declare k text;
begin
  select channel_key into k from public.customer_sessions where id=p_session;
  if k is not null then perform realtime.send(jsonb_build_object('k',p_kind), 'ping', 'kc-'||k, false); end if;
exception when others then null;
end $$;
revoke all on function public.kc_ping(uuid,text) from public, anon, authenticated;

create or replace function public.kc_booking_trg() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  if tg_op='UPDATE' and new.status is distinct from old.status then
    if new.status='completed' then update public.customers set visit_count=visit_count+1 where id=new.customer_id;
    elsif old.status='completed' then update public.customers set visit_count=greatest(visit_count-1,0) where id=new.customer_id; end if;
    perform public.kc_ping(new.session_id,'booking');
  end if;
  return new;
end $$;
create trigger kc_booking_trg before update on public.bookings for each row execute function public.kc_booking_trg();

create or replace function public.kc_message_trg() returns trigger language plpgsql security definer set search_path=public as $$
declare s uuid;
begin
  update public.conversations set last_message_at=new.created_at,
    unread_admin = case when new.sender='customer' then unread_admin+1 else 0 end
  where id=new.conversation_id returning session_id into s;
  if new.sender='admin' then perform public.kc_ping(s,'message'); end if;
  return new;
end $$;
create trigger kc_message_trg after insert on public.messages for each row execute function public.kc_message_trg();

alter publication supabase_realtime add table public.bookings, public.booking_services, public.conversations, public.messages;

-- ===== customer RPCs (service_role only; called by server routes after cookie verification) =====
create or replace function public.kc_session_of(p_hash bytea) returns public.customer_sessions language sql stable security definer set search_path=public as $$
  select * from public.customer_sessions where token_hash=p_hash and not revoked
$$;

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
  insert into public.customer_sessions(customer_id,token_hash) values(cid,p_new_hash) returning * into s;
  return s;
end $$;

create or replace function public.kc_price_and_end(p_services smallint[], p_start timestamptz, out ends timestamptz, out price int, out has_price boolean)
language plpgsql stable security definer set search_path=public as $$
declare n int; mins int;
begin
  if p_services is null or cardinality(p_services)=0 or cardinality(p_services)>6 then raise exception 'invalid_services'; end if;
  select count(*), sum(duration_min), sum(price_npr), bool_and(price_npr is not null) into n, mins, price, has_price
    from public.services where id = any(p_services) and bookable;
  if n <> (select count(distinct x) from unnest(p_services) x) then raise exception 'invalid_services'; end if;
  ends := p_start + make_interval(mins => mins);
  if not has_price then price := null; end if;
end $$;

create or replace function public.kc_check_time(p_start timestamptz, p_end timestamptz) returns void language plpgsql stable as $$
declare ls timestamp := p_start at time zone 'Asia/Kathmandu'; le timestamp := p_end at time zone 'Asia/Kathmandu';
begin
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '60 days' then raise exception 'invalid_time'; end if;
  if extract(minute from ls)::int % 30 <> 0 or extract(second from ls) <> 0 then raise exception 'invalid_time'; end if;
  if ls::time < time '10:00' or le > (ls::date + time '19:00') then raise exception 'outside_hours'; end if;
end $$;

create or replace function public.kc_new_ticket() returns text language plpgsql volatile as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; t text; b bytea;
begin
  loop
    b := gen_random_bytes(6); t := 'KC-';
    for i in 0..5 loop t := t || substr(a, (get_byte(b,i) % 32)+1, 1); end loop;
    exit when not exists(select 1 from public.bookings where ticket_id=t);
  end loop;
  return t;
end $$;

create or replace function public.kc_create_booking(p_hash bytea, p_new_hash bytea, p_name text, p_phone text, p_services smallint[], p_start timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.customer_sessions; pe record; bid uuid; t text; ph text := public.kc_norm_phone(p_phone); created boolean := false;
begin
  s := public.kc_ensure_session(p_hash, p_new_hash, p_name, p_phone);
  created := s.token_hash = p_new_hash;
  if not created and ph is not null and ph <> (select phone from public.customers where id=s.customer_id) then raise exception 'phone_mismatch'; end if;
  if (select count(*) from public.bookings where session_id=s.id and status in ('pending','confirmed') and starts_at>now()) >= 3 then raise exception 'too_many'; end if;
  select * into pe from public.kc_price_and_end(p_services, p_start);
  perform public.kc_check_time(p_start, pe.ends);
  t := public.kc_new_ticket();
  begin
    insert into public.bookings(ticket_id,customer_id,session_id,starts_at,ends_at,total_price_npr)
      values(t,s.customer_id,s.id,p_start,pe.ends,pe.price) returning id into bid;
  exception when exclusion_violation then raise exception 'slot_taken';
  end;
  insert into public.booking_services select bid, id, name, duration_min, price_npr from public.services where id=any(p_services);
  update public.customers set last_booking_at=now(), name=coalesce(nullif(btrim(p_name),''),name) where id=s.customer_id;
  return jsonb_build_object('ticket_id',t,'session_created',created);
end $$;

create or replace function public.kc_update_services(p_hash bytea, p_ticket text, p_services smallint[]) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.customer_sessions; b public.bookings; pe record;
begin
  s := public.kc_session_of(p_hash); if s.id is null then raise exception 'no_session'; end if;
  select * into b from public.bookings where ticket_id=p_ticket and session_id=s.id for update;
  if not found then raise exception 'not_found'; end if;
  if b.status not in ('pending','confirmed') or b.starts_at < now() then raise exception 'locked'; end if;
  select * into pe from public.kc_price_and_end(p_services, b.starts_at);
  perform public.kc_check_time(b.starts_at, pe.ends);
  begin
    update public.bookings set ends_at=pe.ends, total_price_npr=pe.price where id=b.id;
  exception when exclusion_violation then raise exception 'slot_taken';
  end;
  delete from public.booking_services where booking_id=b.id;
  insert into public.booking_services select b.id, id, name, duration_min, price_npr from public.services where id=any(p_services);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.kc_cancel(p_hash bytea, p_ticket text) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.customer_sessions;
begin
  s := public.kc_session_of(p_hash); if s.id is null then raise exception 'no_session'; end if;
  update public.bookings set status='cancelled' where ticket_id=p_ticket and session_id=s.id and status in ('pending','confirmed') and starts_at>now();
  if not found then raise exception 'locked'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.kc_me(p_hash bytea) returns jsonb language sql stable security definer set search_path=public as $$
  with s as (select * from public.customer_sessions where token_hash=p_hash and not revoked)
  select case when not exists(select 1 from s) then null else jsonb_build_object(
    'name', c.name, 'phone', c.phone, 'channel', (select channel_key from s),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('ticket_id',b.ticket_id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,
        'total_price_npr',b.total_price_npr,'services',(select jsonb_agg(jsonb_build_object('id',bs.service_id,'name',bs.name)) from public.booking_services bs where bs.booking_id=b.id))
        order by b.starts_at desc) from (select * from public.bookings where session_id=(select id from s) order by starts_at desc limit 20) b),'[]'::jsonb)
  ) end
  from public.customers c where c.id=(select customer_id from s)
$$;

create or replace function public.kc_messages(p_hash bytea, p_after bigint) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sender',m.sender,'body',m.body,'at',m.created_at) order by m.id),'[]'::jsonb)
  from (select m.* from public.messages m join public.conversations cv on cv.id=m.conversation_id
        join public.customer_sessions s on s.id=cv.session_id and s.token_hash=p_hash and not s.revoked
        where m.id > coalesce(p_after,0) order by m.id desc limit 100) m
$$;

create or replace function public.kc_send(p_hash bytea, p_new_hash bytea, p_name text, p_phone text, p_body text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.customer_sessions; cv uuid; b text := btrim(coalesce(p_body,'')); mid bigint;
begin
  if char_length(b) not between 1 and 1000 then raise exception 'invalid_message'; end if;
  s := public.kc_ensure_session(p_hash, p_new_hash, p_name, p_phone);
  insert into public.conversations(customer_id,session_id) values(s.customer_id,s.id) on conflict(session_id) do nothing;
  select id into cv from public.conversations where session_id=s.id;
  if (select count(*) from public.messages where conversation_id=cv and sender='customer' and created_at>now()-interval '1 minute') >= 15 then raise exception 'rate_limited'; end if;
  insert into public.messages(conversation_id,sender,body) values(cv,'customer',b) returning id into mid;
  return jsonb_build_object('id',mid,'session_created', s.token_hash = p_new_hash);
end $$;

create or replace function public.kc_busy(p_day date) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_array(starts_at,ends_at)),'[]'::jsonb) from public.bookings
  where status in ('pending','confirmed') and starts_at < ((p_day+1)::timestamp at time zone 'Asia/Kathmandu') and ends_at > (p_day::timestamp at time zone 'Asia/Kathmandu')
$$;

create or replace function public.kc_admin_check(p_email text, p_phone text) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_allowlist where email=lower(btrim(p_email)) and phone is not null and phone=public.kc_norm_phone(p_phone))
$$;

do $$ declare f text; begin
  foreach f in array array['kc_session_of(bytea)','kc_ensure_session(bytea,bytea,text,text)','kc_price_and_end(smallint[],timestamptz)','kc_check_time(timestamptz,timestamptz)','kc_new_ticket()',
    'kc_create_booking(bytea,bytea,text,text,smallint[],timestamptz)','kc_update_services(bytea,text,smallint[])','kc_cancel(bytea,text)','kc_me(bytea)','kc_messages(bytea,bigint)',
    'kc_send(bytea,bytea,text,text,text)','kc_busy(date)','kc_admin_check(text,text)','kc_norm_phone(text)','kc_booking_trg()','kc_message_trg()']
  loop execute format('revoke all on function public.%s from public, anon, authenticated', f); execute format('grant execute on function public.%s to service_role', f); end loop;
end $$;
grant execute on function public.kc_norm_phone(text) to authenticated;