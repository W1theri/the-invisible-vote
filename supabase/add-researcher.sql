-- First create a permanent email/password user in Supabase Authentication → Users.
-- Replace the UUID below with that user's ID. Run only in SQL Editor, never browser JS.
insert into iv_private.researchers(user_id)
select id from auth.users
where id = '00000000-0000-0000-0000-000000000000'::uuid
  and coalesce(is_anonymous,false) = false
on conflict do nothing;

-- Verify the intended user was added (no emails are exported in participant results).
select user_id from iv_private.researchers;
