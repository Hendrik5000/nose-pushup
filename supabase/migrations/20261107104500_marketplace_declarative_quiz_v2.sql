BEGIN;

-- Version 2 adds one fixed, data-only quiz object. It does not add tables,
-- permissions, storage, network access, or executable content.
CREATE OR REPLACE FUNCTION public.marketplace_quiz_game_is_valid(p_game JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  question JSONB;
  choice JSONB;
  field_count INTEGER;
  question_count INTEGER;
  choice_count INTEGER;
  correct_index_text TEXT;
  correct_index INTEGER;
  choice_text TEXT;
  seen_choices TEXT[];
BEGIN
  IF p_game IS NULL OR jsonb_typeof(p_game) IS DISTINCT FROM 'object' THEN
    RETURN FALSE;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_game)) <> 5
     OR NOT (p_game ?& ARRAY['type', 'title', 'instructions', 'questions', 'completionMessage']) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_game->'type') IS DISTINCT FROM 'string'
     OR p_game->>'type' IS DISTINCT FROM 'quiz' THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_game->'title') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_game->>'title', 72) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_game->'instructions') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_game->>'instructions', 240) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_game->'completionMessage') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_game->>'completionMessage', 180) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_game->'questions') IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;
  question_count := jsonb_array_length(p_game->'questions');
  IF question_count < 3 OR question_count > 12 THEN
    RETURN FALSE;
  END IF;

  FOR question IN
    SELECT entry.value FROM jsonb_array_elements(p_game->'questions') AS entry(value)
  LOOP
    IF jsonb_typeof(question) IS DISTINCT FROM 'object' THEN
      RETURN FALSE;
    END IF;
    SELECT count(*) INTO field_count FROM jsonb_object_keys(question);
    IF field_count NOT IN (3, 4)
       OR NOT (question ?& ARRAY['prompt', 'choices', 'correctIndex'])
       OR (question - ARRAY['prompt', 'choices', 'correctIndex', 'explanation']) <> '{}'::JSONB THEN
      RETURN FALSE;
    END IF;
    IF jsonb_typeof(question->'prompt') IS DISTINCT FROM 'string'
       OR NOT public.marketplace_text_is_safe(question->>'prompt', 180) THEN
      RETURN FALSE;
    END IF;
    IF jsonb_typeof(question->'choices') IS DISTINCT FROM 'array' THEN
      RETURN FALSE;
    END IF;
    choice_count := jsonb_array_length(question->'choices');
    IF choice_count < 2 OR choice_count > 4 THEN
      RETURN FALSE;
    END IF;
    IF jsonb_typeof(question->'correctIndex') IS DISTINCT FROM 'number' THEN
      RETURN FALSE;
    END IF;
    correct_index_text := question->>'correctIndex';
    IF correct_index_text !~ '^(0|1|2|3)$' THEN
      RETURN FALSE;
    END IF;
    correct_index := correct_index_text::INTEGER;
    IF correct_index < 0 OR correct_index >= choice_count THEN
      RETURN FALSE;
    END IF;

    seen_choices := ARRAY[]::TEXT[];
    FOR choice IN
      SELECT entry.value FROM jsonb_array_elements(question->'choices') AS entry(value)
    LOOP
      IF jsonb_typeof(choice) IS DISTINCT FROM 'string'
         OR NOT public.marketplace_text_is_safe(choice #>> '{}', 80) THEN
        RETURN FALSE;
      END IF;
      choice_text := lower(choice #>> '{}');
      IF choice_text = ANY(seen_choices) THEN
        RETURN FALSE;
      END IF;
      seen_choices := array_append(seen_choices, choice_text);
    END LOOP;

    IF question ? 'explanation'
       AND (jsonb_typeof(question->'explanation') IS DISTINCT FROM 'string'
         OR NOT public.marketplace_text_is_safe(question->>'explanation', 180)) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_quiz_game_is_valid(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.marketplace_manifest_is_valid(p_manifest JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  block JSONB;
  item JSONB;
  block_type TEXT;
  action_id TEXT;
  action_count INTEGER := 0;
  action_ids TEXT[] := ARRAY[]::TEXT[];
  block_count INTEGER;
  item_count INTEGER;
  icon_name TEXT;
  schema_version INTEGER;
BEGIN
  IF p_manifest IS NULL OR jsonb_typeof(p_manifest) IS DISTINCT FROM 'object' THEN
    RETURN FALSE;
  END IF;
  IF octet_length(p_manifest::TEXT) > 16384 THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'schemaVersion') IS DISTINCT FROM 'number'
     OR p_manifest->>'schemaVersion' NOT IN ('1', '2') THEN
    RETURN FALSE;
  END IF;
  schema_version := (p_manifest->>'schemaVersion')::INTEGER;
  IF schema_version = 1 THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_manifest)) <> 5
       OR NOT (p_manifest ?& ARRAY['schemaVersion', 'name', 'description', 'icon', 'blocks']) THEN
      RETURN FALSE;
    END IF;
  ELSIF schema_version = 2 THEN
    IF (SELECT count(*) FROM jsonb_object_keys(p_manifest)) <> 6
       OR NOT (p_manifest ?& ARRAY['schemaVersion', 'name', 'description', 'icon', 'blocks', 'game']) THEN
      RETURN FALSE;
    END IF;
  ELSE
    RETURN FALSE;
  END IF;

  IF jsonb_typeof(p_manifest->'name') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_manifest->>'name', 48) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'description') IS DISTINCT FROM 'string'
     OR NOT public.marketplace_text_is_safe(p_manifest->>'description', 180) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'icon') IS DISTINCT FROM 'string' THEN
    RETURN FALSE;
  END IF;
  icon_name := p_manifest->>'icon';
  IF icon_name NOT IN (
    'mira', 'nexus', 'health', 'settings', 'training', 'admin', 'hub', 'coach',
    'inbox', 'game', 'programs', 'calisthenics', 'run', 'season', 'battle',
    'league', 'leaderboard', 'clubs', 'alarm', 'today', 'search', 'capture',
    'collections', 'shortcuts', 'privacy'
  ) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_typeof(p_manifest->'blocks') IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;
  block_count := jsonb_array_length(p_manifest->'blocks');
  IF block_count > 12 OR (schema_version = 1 AND block_count < 1) THEN
    RETURN FALSE;
  END IF;

  FOR block IN SELECT entry.value FROM jsonb_array_elements(p_manifest->'blocks') AS entry(value)
  LOOP
    IF jsonb_typeof(block) IS DISTINCT FROM 'object'
       OR jsonb_typeof(block->'type') IS DISTINCT FROM 'string' THEN
      RETURN FALSE;
    END IF;
    block_type := block->>'type';

    IF block_type IN ('heading', 'paragraph') THEN
      IF (SELECT count(*) FROM jsonb_object_keys(block)) <> 2
         OR NOT (block ?& ARRAY['type', 'text'])
         OR jsonb_typeof(block->'text') IS DISTINCT FROM 'string' THEN
        RETURN FALSE;
      END IF;
      IF block_type = 'heading'
         AND NOT public.marketplace_text_is_safe(block->>'text', 72) THEN
        RETURN FALSE;
      END IF;
      IF block_type = 'paragraph'
         AND NOT public.marketplace_text_is_safe(block->>'text', 500) THEN
        RETURN FALSE;
      END IF;

    ELSIF block_type = 'list' THEN
      IF (SELECT count(*) FROM jsonb_object_keys(block)) <> 2
         OR NOT (block ?& ARRAY['type', 'items'])
         OR jsonb_typeof(block->'items') IS DISTINCT FROM 'array' THEN
        RETURN FALSE;
      END IF;
      item_count := jsonb_array_length(block->'items');
      IF item_count < 1 OR item_count > 8 THEN
        RETURN FALSE;
      END IF;
      FOR item IN SELECT entry.value FROM jsonb_array_elements(block->'items') AS entry(value)
      LOOP
        IF jsonb_typeof(item) IS DISTINCT FROM 'string'
           OR NOT public.marketplace_text_is_safe(item #>> '{}', 160) THEN
          RETURN FALSE;
        END IF;
      END LOOP;

    ELSIF block_type = 'action' THEN
      IF (SELECT count(*) FROM jsonb_object_keys(block)) <> 3
         OR NOT (block ?& ARRAY['type', 'label', 'actionId'])
         OR jsonb_typeof(block->'label') IS DISTINCT FROM 'string'
         OR jsonb_typeof(block->'actionId') IS DISTINCT FROM 'string'
         OR NOT public.marketplace_text_is_safe(block->>'label', 40) THEN
        RETURN FALSE;
      END IF;
      action_id := block->>'actionId';
      IF action_id NOT IN (
        'route:/ai', 'route:/chat', 'route:/exercises', 'route:/profile',
        'route:/training', 'route:/admin', 'route:/areas', 'route:/tools',
        'route:/coach', 'route:/postfach', 'route:/health', 'route:/programs',
        'route:/calisthenics', 'route:/run', 'route:/season', 'route:/battle',
        'route:/battle-league', 'route:/leaderboard', 'route:/clubs', 'route:/alarm',
        'game:grid-defense', 'game:kupferkern', 'tool:today', 'tool:search',
        'tool:capture', 'tool:collections', 'tool:shortcuts', 'tool:privacy'
      ) OR action_id = ANY(action_ids) THEN
        RETURN FALSE;
      END IF;
      action_ids := array_append(action_ids, action_id);
      action_count := action_count + 1;

    ELSE
      RETURN FALSE;
    END IF;
  END LOOP;

  IF schema_version = 1 THEN
    RETURN action_count BETWEEN 1 AND 4;
  END IF;
  IF action_count > 4 THEN
    RETURN FALSE;
  END IF;
  RETURN public.marketplace_quiz_game_is_valid(p_manifest->'game');
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_manifest_is_valid(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
