-- DECIMA PANTRY - MONTHLY ARCHIVE / CONSUMPTION RESET
-- Run once in Supabase > SQL Editor after the Pantry staff/Admin setup.
-- This does NOT delete old orders and does NOT refill physical stock.
-- It archives each reporting period, preserves order + consumption snapshots,
-- then starts a fresh period whose consumption counters begin at zero.

begin;

create table if not exists public.pantry_reporting_periods (
  id text primary key,
  label text not null,
  started_at timestamptz not null default now(),
  archived_at timestamptz,
  active boolean not null default true,
  opening_inventory jsonb not null default '[]'::jsonb,
  closing_inventory jsonb,
  consumption_snapshot jsonb,
  orders_snapshot jsonb,
  order_count integer not null default 0,
  created_by uuid
);

create unique index if not exists pantry_one_active_reporting_period
  on public.pantry_reporting_periods ((active))
  where active = true;

-- Create the first active reporting period if one does not exist yet.
insert into public.pantry_reporting_periods(
  id, label, active, opening_inventory, created_by
)
select
  'period_' || md5(random()::text || ':' || clock_timestamp()::text),
  to_char(now() at time zone 'Africa/Cairo', 'FMMonth YYYY'),
  true,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'material_id', m.id,
        'name_en', m.name_en,
        'name_ar', m.name_ar,
        'base_unit', m.base_unit,
        'quantity', m.current_quantity
      ) order by m.name_en
    )
    from public.pantry_materials m
  ), '[]'::jsonb),
  auth.uid()
where not exists (
  select 1 from public.pantry_reporting_periods where active = true
);

alter table public.pantry_orders
  add column if not exists reporting_period_id text;

update public.pantry_orders
set reporting_period_id = (
  select id from public.pantry_reporting_periods where active = true limit 1
)
where reporting_period_id is null;

create index if not exists pantry_orders_reporting_period_idx
  on public.pantry_orders(reporting_period_id, created_at desc);

create table if not exists public.pantry_inventory_usage (
  order_id text not null,
  period_id text not null,
  material_id text not null,
  material_name_en text not null,
  material_name_ar text not null,
  base_unit text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  primary key (order_id, material_id)
);

create index if not exists pantry_inventory_usage_period_idx
  on public.pantry_inventory_usage(period_id, material_id);

-- Backfill consumption for orders that existed before this feature was installed.
-- It uses the current saved recipe for those historical orders; all new orders are
-- logged at order time by the trigger below.
with historical_usage as (
  select
    o.id as order_id,
    o.reporting_period_id as period_id,
    x.material_id,
    sum(x.amount) as amount,
    min(o.created_at) as created_at
  from public.pantry_orders o
  cross join lateral (
    select
      ing->>'materialId' as material_id,
      coalesce((ing->>'amount')::numeric, 0) * o.quantity as amount
    from public.pantry_drinks d
    cross join lateral jsonb_array_elements(d.ingredients) ing
    where d.id = o.drink_id

    union all

    select
      (select m.id
       from public.pantry_materials m
       where m.active = true
         and m.base_unit = 'Gram'
         and (m.id = 'sugar' or lower(m.name_en) = 'sugar')
       order by case when m.id = 'sugar' then 0 else 1 end
       limit 1) as material_id,
      (o.sugar_spoons * 5 * o.quantity)::numeric as amount
    where o.sugar_spoons > 0
  ) x
  where o.reporting_period_id is not null
  and x.material_id is not null
  group by o.id, o.reporting_period_id, x.material_id
)
insert into public.pantry_inventory_usage(
  order_id, period_id, material_id, material_name_en, material_name_ar,
  base_unit, amount, created_at
)
select
  h.order_id, h.period_id, h.material_id,
  m.name_en, m.name_ar, m.base_unit,
  h.amount, h.created_at
from historical_usage h
join public.pantry_materials m on m.id = h.material_id
where h.amount > 0
on conflict (order_id, material_id) do nothing;

-- Assign every new order to the currently active reporting period.
create or replace function public.pantry_assign_reporting_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id text;
begin
  select id into v_period_id
  from public.pantry_reporting_periods
  where active = true
  limit 1;

  if v_period_id is null then
    begin
      v_period_id := 'period_' || md5(random()::text || ':' || clock_timestamp()::text);
      insert into public.pantry_reporting_periods(
        id, label, active, opening_inventory, created_by
      ) values (
        v_period_id,
        to_char(now() at time zone 'Africa/Cairo', 'FMMonth YYYY'),
        true,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'material_id', m.id,
              'name_en', m.name_en,
              'name_ar', m.name_ar,
              'base_unit', m.base_unit,
              'quantity', m.current_quantity
            ) order by m.name_en
          ) from public.pantry_materials m
        ), '[]'::jsonb),
        auth.uid()
      );
    exception when unique_violation then
      select id into v_period_id
      from public.pantry_reporting_periods
      where active = true
      limit 1;
    end;
  end if;

  new.reporting_period_id := v_period_id;
  return new;
end;
$$;

drop trigger if exists pantry_00_assign_reporting_period_trigger on public.pantry_orders;
create trigger pantry_00_assign_reporting_period_trigger
before insert on public.pantry_orders
for each row execute function public.pantry_assign_reporting_period();

-- Log the exact ingredient consumption for every new order.
create or replace function public.pantry_log_order_consumption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ing jsonb;
  v_material public.pantry_materials%rowtype;
  v_amount numeric;
  v_sugar public.pantry_materials%rowtype;
begin
  if new.drink_id <> '__custom__' then
    for v_ing in
      select value
      from public.pantry_drinks d,
           lateral jsonb_array_elements(d.ingredients)
      where d.id = new.drink_id
    loop
      select * into v_material
      from public.pantry_materials
      where id = v_ing->>'materialId';

      if found then
        v_amount := coalesce((v_ing->>'amount')::numeric, 0) * new.quantity;
        if v_amount > 0 then
          insert into public.pantry_inventory_usage(
            order_id, period_id, material_id, material_name_en, material_name_ar,
            base_unit, amount, created_at
          ) values (
            new.id, new.reporting_period_id, v_material.id, v_material.name_en,
            v_material.name_ar, v_material.base_unit, v_amount, new.created_at
          )
          on conflict (order_id, material_id)
          do update set amount = public.pantry_inventory_usage.amount + excluded.amount;
        end if;
      end if;
    end loop;
  end if;

  if new.sugar_spoons > 0 then
    select * into v_sugar
    from public.pantry_materials
    where active = true
      and base_unit = 'Gram'
      and (id = 'sugar' or lower(name_en) = 'sugar')
    order by case when id = 'sugar' then 0 else 1 end
    limit 1;

    if found then
      v_amount := new.sugar_spoons * 5 * new.quantity;
      insert into public.pantry_inventory_usage(
        order_id, period_id, material_id, material_name_en, material_name_ar,
        base_unit, amount, created_at
      ) values (
        new.id, new.reporting_period_id, v_sugar.id, v_sugar.name_en,
        v_sugar.name_ar, v_sugar.base_unit, v_amount, new.created_at
      )
      on conflict (order_id, material_id)
      do update set amount = public.pantry_inventory_usage.amount + excluded.amount;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pantry_log_order_consumption_trigger on public.pantry_orders;
create trigger pantry_log_order_consumption_trigger
after insert on public.pantry_orders
for each row execute function public.pantry_log_order_consumption();

-- Admin-only month/batch close. Old orders remain in pantry_orders and are also
-- saved as immutable JSON snapshots on the closed reporting period.
create or replace function public.pantry_close_reporting_period(p_next_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.pantry_reporting_periods%rowtype;
  v_consumption jsonb;
  v_inventory jsonb;
  v_orders jsonb;
  v_order_count integer;
  v_new_id text;
  v_new_label text;
begin
  if not public.pantry_is_staff() then
    raise exception 'staff_required';
  end if;
  if not public.pantry_admin_session_valid() then
    raise exception 'admin_required';
  end if;

  select * into v_current
  from public.pantry_reporting_periods
  where active = true
  for update;

  if not found then
    raise exception 'no_active_reporting_period';
  end if;

  if exists (
    select 1 from public.pantry_orders
    where reporting_period_id = v_current.id
      and status in ('New', 'Preparing')
  ) then
    raise exception 'finish_open_orders_first';
  end if;

  select count(*) into v_order_count
  from public.pantry_orders
  where reporting_period_id = v_current.id;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.name_en), '[]'::jsonb)
  into v_consumption
  from (
    select
      u.material_id,
      max(u.material_name_en) as name_en,
      max(u.material_name_ar) as name_ar,
      max(u.base_unit) as base_unit,
      sum(u.amount) as amount
    from public.pantry_inventory_usage u
    where u.period_id = v_current.id
    group by u.material_id
  ) q;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'material_id', m.id,
      'name_en', m.name_en,
      'name_ar', m.name_ar,
      'base_unit', m.base_unit,
      'quantity', m.current_quantity
    ) order by m.name_en
  ), '[]'::jsonb)
  into v_inventory
  from public.pantry_materials m;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at), '[]'::jsonb)
  into v_orders
  from public.pantry_orders o
  where o.reporting_period_id = v_current.id;

  update public.pantry_reporting_periods
  set active = false,
      archived_at = now(),
      order_count = v_order_count,
      consumption_snapshot = v_consumption,
      closing_inventory = v_inventory,
      orders_snapshot = v_orders
  where id = v_current.id;

  v_new_id := 'period_' || md5(random()::text || ':' || clock_timestamp()::text);
  v_new_label := coalesce(
    nullif(trim(p_next_label), ''),
    to_char((now() at time zone 'Africa/Cairo') + interval '1 month', 'FMMonth YYYY')
  );

  insert into public.pantry_reporting_periods(
    id, label, active, opening_inventory, created_by
  ) values (
    v_new_id,
    v_new_label,
    true,
    v_inventory,
    auth.uid()
  );

  return jsonb_build_object(
    'archived_period_id', v_current.id,
    'archived_label', v_current.label,
    'archived_order_count', v_order_count,
    'new_period_id', v_new_id,
    'new_period_label', v_new_label
  );
end;
$$;

alter table public.pantry_reporting_periods enable row level security;
alter table public.pantry_inventory_usage enable row level security;

drop policy if exists pantry_reporting_periods_staff_read on public.pantry_reporting_periods;
create policy pantry_reporting_periods_staff_read
on public.pantry_reporting_periods
for select to authenticated
using (public.pantry_is_staff());

drop policy if exists pantry_inventory_usage_staff_read on public.pantry_inventory_usage;
create policy pantry_inventory_usage_staff_read
on public.pantry_inventory_usage
for select to authenticated
using (public.pantry_is_staff());

revoke all on public.pantry_reporting_periods from anon;
revoke all on public.pantry_inventory_usage from anon;
grant select on public.pantry_reporting_periods to authenticated;
grant select on public.pantry_inventory_usage to authenticated;

revoke all on function public.pantry_close_reporting_period(text) from public, anon;
grant execute on function public.pantry_close_reporting_period(text) to authenticated;

notify pgrst, 'reload schema';

commit;

select
  'MONTHLY_ARCHIVE_RESET_OK' as result,
  (select label from public.pantry_reporting_periods where active = true limit 1) as active_period,
  (select count(*) from public.pantry_orders where reporting_period_id is null) as unassigned_orders;
