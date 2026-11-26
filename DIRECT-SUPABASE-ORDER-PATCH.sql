-- DECIMA PANTRY - DIRECT ORDER PATCH
-- Run once in Supabase > SQL Editor.
-- This removes the employee-side dependency on the place_pantry_order RPC.
-- Employees may INSERT a new order only. They still cannot read or edit the order queue.
-- A protected trigger validates the request, deducts inventory, and fills display fields.

create extension if not exists pgcrypto;

alter table public.pantry_orders
  add column if not exists custom_location text;

create or replace function public.pantry_prepare_public_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drink public.pantry_drinks%rowtype;
  v_location public.pantry_locations%rowtype;
  v_ing jsonb;
  v_amount numeric;
  v_material_id text;
  v_sugar_id text;
begin
  if new.quantity is null or new.quantity < 1 or new.quantity > 10 then
    raise exception 'invalid_quantity';
  end if;

  new.sugar_spoons := coalesce(new.sugar_spoons, 0);
  if new.sugar_spoons < 0 or new.sugar_spoons > 10 then
    raise exception 'invalid_sugar';
  end if;

  -- Location validation / enrichment.
  if new.location_id = '__custom_location__' then
    if coalesce(trim(new.custom_location), '') = '' then
      raise exception 'custom_location_required';
    end if;
    new.location_name_en := trim(new.custom_location);
    new.location_name_ar := 'موقع مخصص: ' || trim(new.custom_location);
    new.desk_id := null;
  else
    select * into v_location
    from public.pantry_locations
    where id = new.location_id and active = true;

    if not found then raise exception 'invalid_location'; end if;

    new.location_name_en := v_location.name_en;
    new.location_name_ar := v_location.name_ar;

    if v_location.has_desk_map then
      if coalesce(trim(new.desk_id), '') !~ '^[A-D][1-4]$' then
        raise exception 'invalid_desk';
      end if;
    else
      new.desk_id := null;
    end if;
  end if;

  -- Drink validation / enrichment and stock deduction.
  if new.drink_id = '__custom__' then
    if coalesce(trim(new.custom_request), '') = '' then
      raise exception 'custom_request_required';
    end if;
    new.drink_name_en := 'Custom Request';
    new.drink_name_ar := 'طلب خاص';
    new.drink_icon := '✍️';
    new.sugar_spoons := 0;
  else
    select * into v_drink
    from public.pantry_drinks
    where id = new.drink_id and active = true;

    if not found then raise exception 'invalid_drink'; end if;

    new.drink_name_en := v_drink.name_en;
    new.drink_name_ar := v_drink.name_ar;
    new.drink_icon := coalesce(v_drink.icon, '☕');

    for v_ing in select value from jsonb_array_elements(v_drink.ingredients)
    loop
      v_material_id := v_ing->>'materialId';
      v_amount := coalesce((v_ing->>'amount')::numeric, 0) * new.quantity;

      update public.pantry_materials
      set current_quantity = current_quantity - v_amount
      where id = v_material_id
        and active = true
        and current_quantity >= v_amount;

      if not found then
        raise exception 'insufficient_stock:%', v_material_id;
      end if;
    end loop;

    if new.sugar_spoons > 0 then
      select id into v_sugar_id
      from public.pantry_materials
      where active = true
        and base_unit = 'Gram'
        and (id = 'sugar' or lower(name_en) = 'sugar')
      order by case when id = 'sugar' then 0 else 1 end
      limit 1;

      if v_sugar_id is null then raise exception 'sugar_not_found'; end if;

      v_amount := new.sugar_spoons * 5 * new.quantity;
      update public.pantry_materials
      set current_quantity = current_quantity - v_amount
      where id = v_sugar_id and current_quantity >= v_amount;

      if not found then raise exception 'insufficient_stock:sugar'; end if;
    end if;
  end if;

  new.status := 'New';
  new.created_at := coalesce(new.created_at, now());
  new.accepted_at := null;
  new.completed_at := null;
  return new;
end;
$$;

drop trigger if exists pantry_prepare_public_order_trigger on public.pantry_orders;
create trigger pantry_prepare_public_order_trigger
before insert on public.pantry_orders
for each row execute function public.pantry_prepare_public_order();

-- Anonymous employees can only submit orders; they still cannot SELECT the queue.
drop policy if exists pantry_orders_anon_insert on public.pantry_orders;
create policy pantry_orders_anon_insert
on public.pantry_orders
for insert
to anon
with check (true);

-- Authenticated staff may also submit an order if they happen to use the employee page while signed in.
drop policy if exists pantry_orders_authenticated_insert on public.pantry_orders;
create policy pantry_orders_authenticated_insert
on public.pantry_orders
for insert
to authenticated
with check (public.pantry_is_staff());

revoke insert on public.pantry_orders from anon;
grant insert (
  id, drink_id, location_id, desk_id, quantity,
  sugar_spoons, custom_request, custom_location
) on public.pantry_orders to anon;

grant insert (
  id, drink_id, location_id, desk_id, quantity,
  sugar_spoons, custom_request, custom_location
) on public.pantry_orders to authenticated;

-- Identity sequence access for the generated order number.
do $$
declare
  v_seq text;
begin
  v_seq := pg_get_serial_sequence('public.pantry_orders', 'number');
  if v_seq is not null then
    execute format('grant usage, select on sequence %s to anon, authenticated', v_seq);
  end if;
end;
$$;

-- Force PostgREST to see the latest table/trigger/policy state immediately.
notify pgrst, 'reload schema';

select 'DIRECT_ORDER_PATCH_OK' as status,
       has_table_privilege('anon', 'public.pantry_orders', 'INSERT') as anon_can_insert,
       has_table_privilege('anon', 'public.pantry_orders', 'SELECT') as anon_can_read_orders,
       (select count(*) from public.pantry_staff where lower(email)=lower('mahmoud.mohey@decimaintl.com')) as staff_account;
