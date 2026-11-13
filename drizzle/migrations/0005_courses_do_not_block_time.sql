alter table public.bookings add column blocks_time boolean not null default true;
update public.bookings b set blocks_time = exists(select 1 from public.booking_services s where s.booking_id=b.id and s.service_id not in (11,12))
  where exists(select 1 from public.booking_services s where s.booking_id=b.id);
alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap exclude using gist (tstzrange(starts_at,ends_at) with &&)
  where (status in ('pending','confirmed') and blocks_time) deferrable initially deferred;
create or replace function public.kc_blocks_time_trg() returns trigger language plpgsql security definer set search_path=public as $$
declare bid uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.bookings set blocks_time = not exists(select 1 from public.booking_services where booking_id=bid)
    or exists(select 1 from public.booking_services where booking_id=bid and service_id not in (11,12)) where id=bid;
  return null;
end $$;
revoke all on function public.kc_blocks_time_trg() from public, anon, authenticated;
create trigger booking_services_blocks_time after insert or update or delete on public.booking_services for each row execute function public.kc_blocks_time_trg();
create or replace function public.kc_busy(p_day date) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_array(starts_at,ends_at)),'[]'::jsonb) from public.bookings
  where status in ('pending','confirmed') and blocks_time and starts_at < ((p_day+1)::timestamp at time zone 'Asia/Kathmandu') and ends_at > (p_day::timestamp at time zone 'Asia/Kathmandu')
$$;
revoke all on function public.kc_busy(date) from public, anon, authenticated;
grant execute on function public.kc_busy(date) to service_role;