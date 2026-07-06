-- Trends v2: tag every exercise with a muscle group so weekly volume can be
-- broken down per group. Run in the Supabase SQL editor (after 0001).

create type muscle_group as enum (
  'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'other'
);

alter table public.exercises
  add column muscle_group muscle_group not null default 'other';

-- Keyword backfill for existing rows. Match order matters:
-- legs before arms ("leg extension"), chest before shoulders ("bench press"
-- must not hit a bare "press"), shoulders before back ("face pull" must not
-- hit "pull"). Mirrored in guessMuscleGroup() in src/lib/types.ts — keep in sync.
update public.exercises
set muscle_group = case
  when name ~* 'squat|leg|lunge|calf|ham|quad|glute|rdl|romanian|hip thrust' then 'legs'::muscle_group
  when name ~* 'bench|chest|pec|fly|flye|incline|dip|push.?up' then 'chest'::muscle_group
  when name ~* 'overhead|ohp|shoulder|lateral|delt|face pull' then 'shoulders'::muscle_group
  when name ~* 'row|pull.?up|pulldown|pull.?down|deadlift|lat |lats|chin' then 'back'::muscle_group
  when name ~* 'curl|bicep|tricep|pushdown|push.?down|skull' then 'arms'::muscle_group
  when name ~* 'abs?$|abs? |crunch|plank|sit.?up|core' then 'core'::muscle_group
  else 'other'::muscle_group
end;
