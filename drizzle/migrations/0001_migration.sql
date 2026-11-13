alter table public.customer_sessions alter column channel_key set default encode(extensions.gen_random_bytes(18),'hex');
create or replace function public.kc_new_ticket() returns text language plpgsql volatile set search_path=public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; t text; b bytea;
begin
  loop
    b := extensions.gen_random_bytes(6); t := 'KC-';
    for i in 0..5 loop t := t || substr(a, (get_byte(b,i) % 32)+1, 1); end loop;
    exit when not exists(select 1 from public.bookings where ticket_id=t);
  end loop;
  return t;
end $$;
revoke all on function public.kc_new_ticket() from public, anon, authenticated;