-- Review the number of pre-migration unverified accounts before cleanup.
select count(*) as unverified_user_count
from public.users
where is_verified is false;

-- After backing up the data and confirming the count, run this statement separately:
-- delete from public.users where is_verified is false;