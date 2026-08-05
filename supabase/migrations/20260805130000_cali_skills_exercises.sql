-- Insert all 15 Calisthenics skills into the exercises table.
-- ON CONFLICT DO NOTHING so re-running is idempotent.
INSERT INTO public.exercises (id, name, icon, detection_type, unit, description, sort_order)
VALUES
  ('cali_planche_lean',    'Planche Lean',             '🪄', 'timer', 'seconds', 'Vorgelehnte Plank-Position — Grundlage für alle Planche-Skills.',           100),
  ('cali_pseudo_pushup',   'Pseudo Planche Push-Up',   '💪', 'touch', 'reps',    'Push-Up mit nach hinten zeigenden Fingern und vorgelagertem Schwerpunkt.',  101),
  ('cali_tuck_planche',    'Tuck Planche',              '🔮', 'timer', 'seconds', 'Beide Beine eng an den Bauch gezogen, Hüfte parallel zum Boden.',           102),
  ('cali_adv_tuck_planche','Advanced Tuck Planche',    '⚡', 'timer', 'seconds', 'Rücken flach, Knie noch nah am Bauch, Hüfte tiefer.',                       103),
  ('cali_straddle_planche','Straddle Planche',          '✨', 'timer', 'seconds', 'Beine V-förmig gespreizt, Hüfte auf Schulterniveau.',                       104),
  ('cali_full_planche',    'Full Planche',              '🏆', 'timer', 'seconds', 'Körper waagerecht, Beine zusammen. Elite-Level.',                           105),
  ('cali_dead_hang',       'Dead Hang',                 '🙌', 'timer', 'seconds', 'Passives Hängen an der Stange — Grundlage für alle Reck-Skills.',           110),
  ('cali_tuck_fl',         'Tuck Front Lever',          '🔵', 'timer', 'seconds', 'Knie zur Brust, Hüfte auf Stangehöhe, Körper waagerecht.',                  111),
  ('cali_adv_tuck_fl',     'Advanced Tuck Front Lever','🟦', 'timer', 'seconds', 'Rücken flacher, Knie noch in Tucking-Position.',                            112),
  ('cali_straddle_fl',     'Straddle Front Lever',      '💠', 'timer', 'seconds', 'Beine V-förmig gespreizt, Körper waagerecht.',                              113),
  ('cali_full_fl',         'Full Front Lever',          '🏅', 'timer', 'seconds', 'Körper waagerecht, Beine zusammen gestreckt. Elite.',                       114),
  ('cali_wall_hs',         'Wall Handstand',            '🧱', 'timer', 'seconds', 'Handstand mit dem Rücken zur Wand — Grundposition.',                        120),
  ('cali_chest_wall_hs',   'Chest-to-Wall Handstand',  '🫀', 'timer', 'seconds', 'Brust zur Wand — trainiert gerades Alignment.',                             121),
  ('cali_freestand_hs',    'Freistehender Handstand',   '🌟', 'timer', 'seconds', 'Balance ohne Wand — der eigentliche Handstand.',                            122),
  ('cali_hs_pushup',       'Handstand Push-Up',         '👑', 'touch', 'reps',    'Push-Up im Handstand. Maximale Schulter-Kraft.',                            123)
ON CONFLICT (id) DO NOTHING;
