-- User-ranked goal ordering (drag-and-drop by importance). Lower position =
-- more important; the dashboard shows the top 3. Existing goals keep their
-- creation order. Run in the Supabase SQL editor (after 0008).

alter table public.goals
  add column position int not null default 0;

update public.goals g
set position = sub.rn
from (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from public.goals
) sub
where g.id = sub.id;
