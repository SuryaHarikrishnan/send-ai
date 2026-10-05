-- Demo people: the same 38 made-up people as the PostHog demo data, added as accounts with
-- about five weeks of workouts, climbs and food logs, so the app and the owner Stats screen
-- show a lived-in database. They are data only: no password and no Google account, so nobody
-- can sign in as them.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once: it does nothing if the demo people are already there.
-- Every demo person has an email ending in @demo.justsend.fit and demo_seed = true in their
-- app metadata. To remove them and everything they logged, run supabase/demo-people-remove.sql.

do $$
declare
  -- first name, last name, sports, time zone, been around the whole five weeks
  people jsonb := '[
    ["Maya", "Chen", "lifting", "America/New_York", false],
    ["Jordan", "Reyes", "lifting", "America/New_York", true],
    ["Priya", "Nair", "lifting", "Asia/Kolkata", true],
    ["Sam", "Okafor", "lifting", "America/New_York", false],
    ["Alex", "Kim", "lifting", "America/New_York", false],
    ["Chris", "Walsh", "lifting", "America/New_York", false],
    ["Dee", "Martinez", "lifting", "America/New_York", false],
    ["Ravi", "Patel", "lifting", "America/New_York", true],
    ["Tom", "Becker", "lifting", "America/New_York", true],
    ["Kim", "Nguyen", "lifting", "America/New_York", false],
    ["Lee", "Park", "lifting", "America/New_York", true],
    ["Ana", "Silva", "lifting", "America/New_York", true],
    ["Ben", "Carter", "lifting", "America/New_York", true],
    ["Noah", "Fischer", "lifting", "America/New_York", true],
    ["Zoe", "Adams", "climbing", "America/New_York", true],
    ["Marco", "Rossi", "climbing", "America/New_York", true],
    ["Ivy", "Brooks", "climbing", "America/New_York", false],
    ["Hugo", "Laurent", "climbing", "America/New_York", false],
    ["Nina", "Kowalski", "climbing", "America/New_York", true],
    ["Eli", "Turner", "climbing", "America/New_York", true],
    ["Grace", "Lin", "food", "America/New_York", false],
    ["Omar", "Haddad", "food", "America/New_York", false],
    ["Lena", "Vogel", "food", "America/New_York", false],
    ["Femi", "Adebayo", "food", "America/New_York", false],
    ["Sara", "Lindqvist", "food", "America/New_York", true],
    ["Will", "Hughes", "food", "America/New_York", true],
    ["Hana", "Sato", "food", "America/New_York", false],
    ["Leo", "Moreau", "food", "America/New_York", false],
    ["Aroha", "Ngata", "food", "Pacific/Auckland", true],
    ["Dylan", "Price", "food", "America/New_York", true],
    ["Lucia", "Gomez", "food", "America/New_York", false],
    ["Jade", "Murphy", "food", "America/New_York", true],
    ["Ryan", "Cooper", "food", "America/New_York", true],
    ["Mei", "Zhang", "food", "America/New_York", false],
    ["Riley", "Shaw", "lifting,climbing,food", "America/New_York", true],
    ["Kai", "Jensen", "lifting", "America/New_York", true],
    ["Isla", "Grant", "food,lifting", "America/New_York", true],
    ["Theo", "Russo", "lifting", "America/New_York", true]
  ]';
  -- [exercise, starting weight in lb (0 = body weight), reps]
  lifts jsonb := '{
    "Push": [["Bench press", 135, 8], ["Overhead press", 85, 8], ["Incline dumbbell press", 50, 10], ["Lateral raise", 20, 12], ["Triceps pushdown", 50, 12]],
    "Pull": [["Pull-up", 0, 8], ["Barbell row", 115, 8], ["Lat pulldown", 120, 10], ["Face pull", 40, 15], ["Barbell curl", 60, 10]],
    "Legs": [["Back squat", 185, 5], ["Romanian deadlift", 155, 8], ["Leg press", 270, 10], ["Leg curl", 80, 12], ["Calf raise", 90, 15]],
    "Upper": [["Bench press", 135, 6], ["Barbell row", 115, 8], ["Dumbbell shoulder press", 40, 10], ["Lat pulldown", 120, 10], ["Hammer curl", 30, 12]],
    "Lower": [["Deadlift", 225, 5], ["Front squat", 135, 6], ["Walking lunge", 30, 10], ["Hip thrust", 155, 10], ["Plank", 0, 1]],
    "Full body": [["Back squat", 165, 6], ["Bench press", 125, 8], ["Dumbbell row", 55, 10], ["Overhead press", 75, 8], ["Hanging leg raise", 0, 12]]
  }';
  lift_names text[] := array['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body'];
  boulder text[] := array['VB','V0','V1','V2','V3','V4','V5','V6','V7','V8'];
  sport_grades text[] := array['5.7','5.8','5.9','5.10a','5.10b','5.10c','5.10d','5.11a','5.11b','5.11c','5.11d','5.12a'];
  angles text[] := array['slab', 'vertical', 'overhang', 'cave'];
  holds text[] := array['crimp', 'sloper', 'pinch', 'jug', 'pocket', 'mixed'];
  -- name -> [group, kcal, protein, carbs, fat per 100 g, unit, grams per unit, plural, usual amount]
  -- (from the built-in common foods in src/food.js)
  foods jsonb := '{
    "Oats, dry": ["Grains", 379, 13.2, 67.7, 6.5, "cup", 80, "cups", 0.5],
    "Banana": ["Fruit", 89, 1.1, 22.8, 0.3, "medium", 118, "medium", 1],
    "Egg": ["Protein", 143, 12.6, 0.7, 9.5, "large", 50, "large", 2],
    "Whole wheat bread": ["Grains", 252, 12.4, 42.7, 3.5, "slice", 32, "slices", 2],
    "Greek yogurt, plain nonfat": ["Dairy", 59, 10.2, 3.6, 0.4, "container", 170, "containers", 1],
    "Blueberries": ["Fruit", 57, 0.7, 14.5, 0.3, "cup", 148, "cups", 1],
    "Bagel": ["Grains", 257, 10, 50.5, 1.7, "bagel", 105, "bagels", 1],
    "Latte, 2% milk": ["Drinks", 40, 2.7, 4, 1.5, "grande", 473, "grandes", 1],
    "Coffee, black": ["Drinks", 1, 0.1, 0, 0, "cup", 240, "cups", 1],
    "Peanut butter": ["Fats & nuts", 588, 25, 20, 50, "tbsp", 16, "tbsp", 2],
    "Chicken breast, cooked": ["Protein", 165, 31, 0, 3.6, "breast", 172, "breasts", 1],
    "White rice, cooked": ["Grains", 130, 2.7, 28, 0.3, "cup", 158, "cups", 1],
    "Brown rice, cooked": ["Grains", 123, 2.7, 25.6, 1, "cup", 195, "cups", 1],
    "Mixed salad greens": ["Veg", 17, 1.4, 3.3, 0.2, "cup", 36, "cups", 2],
    "Turkey breast, deli": ["Protein", 104, 17, 3.5, 2, "slice", 28, "slices", 2],
    "Tuna, canned in water": ["Protein", 116, 25.5, 0, 0.8, "can", 142, "cans", 1],
    "Flour tortilla": ["Grains", 306, 8.2, 50.6, 7.8, "medium", 45, "medium", 1],
    "Cheese pizza": ["Snacks", 266, 11.4, 33, 9.7, "slice", 107, "slices", 1],
    "Apple": ["Fruit", 52, 0.3, 13.8, 0.2, "medium", 182, "medium", 1],
    "Salmon, cooked": ["Protein", 206, 22, 0, 12.4, "fillet", 154, "fillets", 1],
    "Sirloin steak, cooked": ["Protein", 244, 27, 0, 14, "steak", 170, "steaks", 1],
    "Pasta, cooked": ["Grains", 158, 5.8, 30.9, 0.9, "cup", 140, "cups", 1],
    "Broccoli": ["Veg", 35, 2.4, 7.2, 0.4, "cup", 91, "cups", 1],
    "Baked potato": ["Veg", 93, 2.5, 21, 0.1, "medium", 173, "medium", 1],
    "Sweet potato": ["Veg", 90, 2, 20.7, 0.2, "medium", 114, "medium", 1],
    "Tofu, firm": ["Protein", 144, 17.3, 2.8, 8.7, "cup", 252, "cups", 0.5],
    "Ground beef 90% lean, cooked": ["Protein", 217, 26, 0, 11.7, "patty", 113, "patties", 1],
    "Red wine": ["Drinks", 85, 0.1, 2.6, 0, "glass", 147, "glasses", 1],
    "Protein bar": ["Snacks", 333, 33, 37, 12, "bar", 60, "bars", 1],
    "Almonds": ["Fats & nuts", 579, 21.2, 21.6, 49.9, "cup", 143, "cups", 0.25],
    "Dark chocolate": ["Snacks", 598, 7.8, 45.9, 42.6, "square", 10, "squares", 2],
    "Popcorn, air-popped": ["Snacks", 387, 13, 78, 4.5, "cup", 8, "cups", 3],
    "Whey protein": ["Protein", 400, 80, 10, 5, "scoop", 30, "scoops", 1],
    "Hummus": ["Fats & nuts", 166, 7.9, 14.3, 9.6, "tbsp", 15, "tbsp", 2]
  }';
  menu jsonb := '{
    "breakfast": ["Oats, dry", "Banana", "Egg", "Whole wheat bread", "Greek yogurt, plain nonfat", "Blueberries", "Bagel", "Latte, 2% milk", "Coffee, black", "Peanut butter"],
    "lunch": ["Chicken breast, cooked", "White rice, cooked", "Mixed salad greens", "Turkey breast, deli", "Whole wheat bread", "Tuna, canned in water", "Flour tortilla", "Cheese pizza", "Apple", "Hummus"],
    "dinner": ["Salmon, cooked", "Sirloin steak, cooked", "Pasta, cooked", "Broccoli", "Baked potato", "Sweet potato", "Tofu, firm", "Brown rice, cooked", "Ground beef 90% lean, cooked", "Red wine"],
    "snack": ["Protein bar", "Almonds", "Dark chocolate", "Popcorn, air-popped", "Whey protein", "Apple", "Banana", "Greek yogurt, plain nonfat"]
  }';
  meal_hours jsonb := '{"breakfast": [7, 9.5], "lunch": [11.5, 14], "dinner": [18, 21], "snack": [15, 16.5]}';
  p jsonb; f jsonb; uid uuid; tz text; s text; meal text; item text;
  join_ago int; quit_ago int; d int; day date; t timestamptz; first_t timestamptz; last_t timestamptz;
  keen float; strong float; morning boolean; level int; weeks int; n int; g int; amt numeric; grams numeric;
  style text; grade text; meals text[]; liquid boolean;
  angle_type text; hold_type_type text;
begin
  if exists (select 1 from auth.users where raw_app_meta_data->>'demo_seed' = 'true') then
    raise notice 'The demo people are already there. Run supabase/demo-people-remove.sql first to start over.';
    return;
  end if;
  perform setseed(0.645901);

  -- wall_angle and hold_type may be text[], jsonb or text depending on how climbs was made.
  select data_type into angle_type from information_schema.columns
    where table_schema = 'public' and table_name = 'climbs' and column_name = 'wall_angle';
  select data_type into hold_type_type from information_schema.columns
    where table_schema = 'public' and table_name = 'climbs' and column_name = 'hold_type';

  for i in 0 .. jsonb_array_length(people) - 1 loop
    p := people->i;
    uid := gen_random_uuid();
    tz := p->>3;
    -- When they joined (days ago), whether they drift away, and how keen, strong and good they are.
    join_ago := case when (p->>4)::boolean then 35 else 5 + floor(random() * 28)::int end;
    quit_ago := case when join_ago > 12 and random() < 0.2 then floor(random() * (join_ago - 7))::int else -1 end;
    keen := random(); strong := 0.6 + random() * 0.6; morning := random() < 0.45;
    level := 2 + floor(random() * 4)::int;

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(format('%s.%s@demo.justsend.fit', p->>0, p->>1)), '', now(),
      '{"provider": "email", "providers": ["email"], "demo_seed": true}',
      jsonb_build_object('full_name', (p->>0) || ' ' || (p->>1), 'name', (p->>0) || ' ' || (p->>1)),
      now(), now(), now(), '', '', '', '');

    for d in reverse join_ago .. 0 loop
      exit when quit_ago >= 0 and d < quit_ago;
      day := (now() at time zone tz)::date - d;
      weeks := (join_ago - d) / 7;
      foreach s in array string_to_array(p->>2, ',') loop
        -- Show up on the first day, then a few times a week (lifters less at weekends).
        if d <> join_ago and random() > (case s when 'food' then 4 + 3 * keen when 'lifting' then 2 + 3 * keen else 1.5 + 2 * keen end) / 7
            * (case when s = 'lifting' and extract(isodow from day) >= 6 then 0.6 else 1 end) then
          continue;
        end if;

        if s = 'lifting' then
          t := (day + make_interval(secs => (case when morning then 5.5 + 3 * random() else 17 + 3.5 * random() end) * 3600)) at time zone tz;
          continue when t > now();
          style := lift_names[1 + floor(random() * 6)::int];
          f := lifts->style;
          -- Most of the usual exercises, 3 or 4 sets each, adding 5 lb a week for the first month.
          insert into public.workouts (user_id, title, performed_at, duration_min, exercises, created_at)
          select uid, style, t, 40 + floor(random() * 46)::int, jsonb_agg(ex order by o), t
          from (
            select o, jsonb_build_object('name', e->>0, 'sets', (
              select jsonb_agg(jsonb_build_object(
                'reps', greatest(1, (e->>2)::int + floor(random() * 3)::int - 1 + 0 * k),
                'weight', case when (e->>1)::numeric = 0 then 0
                               else round((e->>1)::numeric * strong / 5) * 5 + 5 * least(weeks, 4) end))
              from generate_series(1, 3 + (random() < 0.4)::int + 0 * o) as sets(k)
            )) as ex
            from jsonb_array_elements(f) with ordinality as x(e, o)
            where o <= 3 or random() < 0.85
          ) y;

        elsif s = 'climbing' then
          t := (day + make_interval(secs => (case when extract(isodow from day) <= 5 then 17.5 + 3.5 * random() else 10 + 6 * random() end) * 3600)) at time zone tz;
          continue when t > now();
          style := case when random() < 0.7 then 'boulder' else 'sport' end;
          for n in 1 .. 2 + floor(random() * 6)::int loop
            g := level + floor(random() * 3)::int - 1 + weeks / 3;
            grade := case when style = 'boulder' then boulder[least(greatest(g, 1), 10)] else sport_grades[least(greatest(g + 1, 1), 12)] end;
            t := t + make_interval(mins => 4 + floor(random() * 15)::int);
            insert into public.climbs (user_id, grade, style, wall_angle, hold_type, attempts, sent, notes, created_at)
            select r.user_id, r.grade, r.style, r.wall_angle, r.hold_type, r.attempts, r.sent, r.notes, r.created_at
            from jsonb_populate_record(null::public.climbs, jsonb_build_object(
              'user_id', uid, 'grade', grade, 'style', style,
              'wall_angle', case when angle_type = 'text' then to_jsonb(angles[1 + floor(random() * 4)::int])
                                 else jsonb_build_array(angles[1 + floor(random() * 4)::int]) end,
              'hold_type', case when hold_type_type = 'text' then to_jsonb(holds[1 + floor(random() * 6)::int])
                                else jsonb_build_array(holds[1 + floor(random() * 6)::int]) end,
              'attempts', 1 + floor(random() * 6)::int, 'sent', random() < 0.65, 'notes', '', 'created_at', t)) r;
          end loop;

        else
          meals := array['breakfast', 'lunch', 'dinner'];
          if random() < 0.4 then meals := meals || 'snack'::text; end if;
          foreach meal in array meals loop
            continue when random() > 0.85 and meal <> 'dinner';
            t := (day + make_interval(secs => ((meal_hours->meal->>0)::float
                   + random() * ((meal_hours->meal->>1)::float - (meal_hours->meal->>0)::float)) * 3600)) at time zone tz;
            continue when t > now();
            for n in 1 .. 1 + floor(random() * (case when meal = 'snack' then 1 else 3 end))::int loop
              item := menu->meal->>floor(random() * jsonb_array_length(menu->meal))::int;
              f := foods->item;
              liquid := f->>0 = 'Drinks';
              amt := (f->>8)::numeric * (array[0.5, 1, 1, 1, 1.5, 2])[1 + floor(random() * 6)::int];
              grams := amt * (f->>6)::numeric;
              insert into public.food_logs (user_id, eaten_at, meal, name, source, amount, unit, grams,
                kcal, protein_g, carbs_g, fat_g, food, created_at)
              values (uid, t, meal, item, 'common', amt, 'unit', round(grams, 1),
                round((f->>1)::numeric * grams / 100), round((f->>2)::numeric * grams / 100, 1),
                round((f->>3)::numeric * grams / 100, 1), round((f->>4)::numeric * grams / 100, 1),
                jsonb_build_object('name', item, 'brand', '', 'barcode', '', 'source', 'common', 'group', f->0,
                  'per100', jsonb_build_object('kcal', f->1, 'protein', f->2, 'carbs', f->3, 'fat', f->4),
                  'perServing', null,
                  'units', jsonb_build_array(
                    jsonb_build_object('id', 'unit', 'label', f->5, 'plural', f->7, 'g', f->6),
                    case when liquid then '{"id": "ml", "label": "ml", "g": 1}'::jsonb else '{"id": "g", "label": "g", "g": 1}'::jsonb end,
                    case when liquid then '{"id": "floz", "label": "fl oz", "g": 29.57}'::jsonb else '{"id": "oz", "label": "oz", "g": 28.35}'::jsonb end),
                  'defaultUnit', 'unit', 'defaultAmount', f->8),
                t + make_interval(secs => n * 20));
              t := t + make_interval(secs => 30);
            end loop;
          end loop;
        end if;
      end loop;
    end loop;

    -- Signed up just before their first entry, last seen at their latest one.
    select min(c), max(c) into first_t, last_t from (
      select created_at c from public.workouts where user_id = uid
      union all select created_at from public.climbs where user_id = uid
      union all select created_at from public.food_logs where user_id = uid) x;
    first_t := coalesce(first_t, now() - make_interval(days => join_ago));
    update auth.users set created_at = first_t - interval '3 minutes', email_confirmed_at = first_t - interval '3 minutes',
      updated_at = coalesce(last_t, first_t), last_sign_in_at = coalesce(last_t, first_t)
    where id = uid;
  end loop;
end $$;

-- Check: how many demo people and entries there are now.
select
  (select count(*) from auth.users where raw_app_meta_data->>'demo_seed' = 'true') as demo_people,
  (select count(*) from public.workouts w join auth.users u on u.id = w.user_id where u.raw_app_meta_data->>'demo_seed' = 'true') as workouts,
  (select count(*) from public.climbs c join auth.users u on u.id = c.user_id where u.raw_app_meta_data->>'demo_seed' = 'true') as climbs,
  (select count(*) from public.food_logs f join auth.users u on u.id = f.user_id where u.raw_app_meta_data->>'demo_seed' = 'true') as food_logs;
