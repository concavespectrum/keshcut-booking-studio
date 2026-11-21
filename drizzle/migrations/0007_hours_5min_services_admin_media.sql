create or replace function public.kc_check_time(p_start timestamptz, p_end timestamptz) returns void language plpgsql stable as $$
declare ls timestamp := p_start at time zone 'Asia/Kathmandu'; le timestamp := p_end at time zone 'Asia/Kathmandu';
begin
  if p_start < now() + interval '15 minutes' or p_start > now() + interval '60 days' then raise exception 'invalid_time'; end if;
  if extract(minute from ls)::int % 5 <> 0 or extract(second from ls) <> 0 then raise exception 'invalid_time'; end if;
  if ls::time < time '09:00' or le > (ls::date + time '19:00') then raise exception 'outside_hours'; end if;
end $$;

update public.services set name='Barber Training & Academy Courses' where id=11;
update public.services set bookable=false where id=12;
create sequence if not exists public.services_id_seq start 100 owned by public.services.id;
alter table public.services alter column id set default nextval('public.services_id_seq');
grant usage on sequence public.services_id_seq to authenticated, service_role;
grant insert, update on public.services to authenticated;
create policy "admin add services" on public.services for insert to authenticated with check (public.is_admin());
create policy "admin edit services" on public.services for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.kc_admin_reschedule(p_id uuid, p_start timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings; mins int; ls timestamp := p_start at time zone 'Asia/Kathmandu'; e timestamptz;
begin
  if not public.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into b from public.bookings where id=p_id for update;
  if not found then raise exception 'not_found'; end if;
  if b.status not in ('pending','confirmed') then raise exception 'locked'; end if;
  select coalesce(sum(duration_min),30) into mins from public.booking_services where booking_id=p_id;
  e := p_start + make_interval(mins => mins);
  if extract(minute from ls)::int % 5 <> 0 or ls::time < time '09:00' or (e at time zone 'Asia/Kathmandu') > (ls::date + time '19:00') then raise exception 'outside_hours'; end if;
  begin
    update public.bookings set starts_at=p_start, ends_at=e where id=p_id;
    set constraints public.bookings_no_overlap immediate;
  exception when exclusion_violation then raise exception 'slot_taken';
  end;
  perform public.kc_ping(b.session_id,'booking');
  return jsonb_build_object('ok',true,'starts_at',p_start,'ends_at',e);
end $$;
revoke all on function public.kc_admin_reschedule(uuid,timestamptz) from public, anon;
grant execute on function public.kc_admin_reschedule(uuid,timestamptz) to authenticated;

create table public.site_media(
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('teach','studio')),
  kind text not null check (kind in ('image','video')),
  path text not null, poster text, title text not null default '' check (char_length(title) <= 120),
  sort int not null default 0, created_at timestamptz not null default now());
grant select on public.site_media to anon, authenticated;
grant insert, update, delete on public.site_media to authenticated;
grant all on public.site_media to service_role;
alter table public.site_media enable row level security;
create policy "media public read" on public.site_media for select to anon, authenticated using (true);
create policy "admin add media" on public.site_media for insert to authenticated with check (public.is_admin());
create policy "admin edit media" on public.site_media for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin remove media" on public.site_media for delete to authenticated using (public.is_admin());
insert into public.site_media(section,kind,path,poster,title,sort) values
('teach','video','/videos/class-clip-1.mp4','/images/gallery/class-clip-1-poster.jpg','Classroom lesson',1),
('teach','video','/videos/class-clip-2.mp4','/images/gallery/class-clip-2-poster.jpg','Instructor and students',2),
('teach','video','/videos/class-clip-3.mp4','/images/gallery/class-clip-3-poster.jpg','Watch and learn: class session',3),
('studio','image','/images/gallery/studio-interior-stone-partition.jpg',null,'KeshCut Studio interior with mirrors, hanging plants and a stone partition',1),
('studio','image','/images/gallery/studio-interior-mask-wall.jpg',null,'KeshCut Studio interior with a carved mask on the wall',2),
('studio','image','/images/gallery/studio-interior-night.jpg',null,'KeshCut Studio interior at night',3);

create policy "admin upload site media" on storage.objects for insert to authenticated with check (bucket_id='site-media' and public.is_admin());
create policy "admin delete site media" on storage.objects for delete to authenticated using (bucket_id='site-media' and public.is_admin());
create policy "admin update site media" on storage.objects for update to authenticated using (bucket_id='site-media' and public.is_admin());