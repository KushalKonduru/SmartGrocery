-- Automatically create a profile row for every new auth user
create function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    full_name,
    phone,
    address,
    pincode,
    onboarding_completed
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Pantry Pro'),
    coalesce(new.raw_user_meta_data->>'phone', 'NA'),
    coalesce(new.raw_user_meta_data->>'address', 'Update me'),
    coalesce(new.raw_user_meta_data->>'pincode', '000000'),
    false
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_profile();

