CREATE OR REPLACE FUNCTION public.kc_admin_delete_ticket(p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare b public.bookings;
begin
 if not public.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into b from public.bookings where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 delete from public.booking_services where booking_id=p_id;
 delete from public.bookings where id=p_id;
 delete from public.messages where conversation_id in (select id from public.conversations where session_id=b.session_id);
 delete from public.conversations where session_id=b.session_id;
 perform public.kc_ping(b.session_id,'booking');
 perform public.kc_ping(b.session_id,'message');
 if not exists(select 1 from public.bookings where session_id=b.session_id) then
   delete from public.customer_sessions where id=b.session_id;
 end if;
 if not exists(select 1 from public.bookings where customer_id=b.customer_id)
    and not exists(select 1 from public.conversations where customer_id=b.customer_id) then
   delete from public.customer_sessions where customer_id=b.customer_id;
   delete from public.customers where id=b.customer_id;
 else
   if b.status='completed' then update public.customers set visit_count=greatest(visit_count-1,0) where id=b.customer_id; end if;
   update public.customers set last_booking_at=(select max(created_at) from public.bookings where customer_id=b.customer_id) where id=b.customer_id;
 end if;
 return jsonb_build_object('ok',true);
end $function$;