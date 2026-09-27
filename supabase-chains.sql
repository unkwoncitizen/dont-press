-- DON'T PRESS — Collaborative Goal Chains
-- Run this in the Supabase SQL Editor AFTER supabase-schema.sql
--
-- Design notes
-- ------------
-- The existing `chains` table is reused rather than duplicated. It already
-- existed but nothing in the app ever wrote to it, so extending it introduces
-- no conflicting data. `chain_nodes` is left untouched because profile stats
-- still read it.
--
-- All validation and progress maths happen inside SECURITY DEFINER functions
-- rather than in the browser. Two reasons:
--   1. The authenticated user id is taken from auth.uid() (the JWT), so a
--      client cannot contribute as somebody else.
--   2. The chain row is locked with FOR UPDATE before the progress check, so
--      two simultaneous contributions are serialised instead of both passing
--      the "amount <= remaining" test and overshooting the goal.
--
-- There is deliberately NO insert policy on chain_contributions. Clients
-- cannot write contributions directly at all; they must go through
-- contribute_to_chain(), which is the only place validation exists.

-- ============================================================================
-- 1. Extend `chains` into a measurable goal chain
-- ============================================================================

ALTER TABLE public.chains
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS goal_amount INTEGER,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS current_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Goal chains are the only kind that use the new columns. Existing (empty)
-- story-chain rows keep working with the legacy shape.
ALTER TABLE public.chains
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'story';

ALTER TABLE public.chains DROP CONSTRAINT IF EXISTS chains_goal_amount_positive;
ALTER TABLE public.chains ADD CONSTRAINT chains_goal_amount_positive
  CHECK (goal_amount IS NULL OR goal_amount > 0);

ALTER TABLE public.chains DROP CONSTRAINT IF EXISTS chains_current_amount_non_negative;
ALTER TABLE public.chains ADD CONSTRAINT chains_current_amount_non_negative
  CHECK (current_amount >= 0);

-- The hard guarantee that total progress can never exceed the goal.
ALTER TABLE public.chains DROP CONSTRAINT IF EXISTS chains_progress_within_goal;
ALTER TABLE public.chains ADD CONSTRAINT chains_progress_within_goal
  CHECK (goal_amount IS NULL OR current_amount <= goal_amount);

ALTER TABLE public.chains DROP CONSTRAINT IF EXISTS chains_visibility_valid;
ALTER TABLE public.chains ADD CONSTRAINT chains_visibility_valid
  CHECK (visibility IN ('public', 'private'));

ALTER TABLE public.chains DROP CONSTRAINT IF EXISTS chains_status_valid;
ALTER TABLE public.chains ADD CONSTRAINT chains_status_valid
  CHECK (status IN ('active', 'completed'));

CREATE INDEX IF NOT EXISTS chains_kind_status_idx ON public.chains (kind, status);
CREATE INDEX IF NOT EXISTS chains_creator_idx ON public.chains (started_by_user_id);

-- ============================================================================
-- 2. Contributions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chain_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id UUID REFERENCES public.chains(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  message TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chain_contributions_chain_idx
  ON public.chain_contributions (chain_id, created_at);

CREATE INDEX IF NOT EXISTS chain_contributions_user_idx
  ON public.chain_contributions (user_id);

ALTER TABLE public.chain_contributions ENABLE ROW LEVEL SECURITY;

-- Anyone may read contributions so chain history renders for all viewers.
-- Only the SECURITY DEFINER function below can write them.
DROP POLICY IF EXISTS "Anyone can view chain contributions" ON public.chain_contributions;
CREATE POLICY "Anyone can view chain contributions" ON public.chain_contributions
  FOR SELECT USING (true);

-- ============================================================================
-- 3. Create a chain (with the creator's mandatory first contribution)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_goal_chain(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_goal_amount INTEGER,
  p_unit TEXT,
  p_visibility TEXT DEFAULT 'public',
  p_image_url TEXT DEFAULT NULL,
  p_initial_amount INTEGER DEFAULT NULL,
  p_initial_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_chain_id UUID;
  v_initial INTEGER := COALESCE(p_initial_amount, 0);
  v_status TEXT := 'active';
  v_completed_at TIMESTAMP WITH TIME ZONE := NULL;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to start a chain.'
      USING ERRCODE = '42501';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) < 3 THEN
    RAISE EXCEPTION 'Chain title must be at least 3 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF length(trim(p_title)) > 120 THEN
    RAISE EXCEPTION 'Chain title must be 120 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;

  IF p_goal_amount IS NULL OR p_goal_amount <= 0 THEN
    RAISE EXCEPTION 'Goal must be greater than zero.'
      USING ERRCODE = '22023';
  END IF;

  IF p_unit IS NULL OR length(trim(p_unit)) = 0 THEN
    RAISE EXCEPTION 'Please provide a unit of measurement.'
      USING ERRCODE = '22023';
  END IF;

  IF p_visibility IS NULL OR p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Invalid visibility.'
      USING ERRCODE = '22023';
  END IF;

  -- The creator must seed the chain with a real contribution.
  IF v_initial <= 0 THEN
    RAISE EXCEPTION 'Enter how much you accomplished to start the chain.'
      USING ERRCODE = '22023';
  END IF;

  IF v_initial > p_goal_amount THEN
    RAISE EXCEPTION 'Your first contribution cannot be more than the goal (%).', p_goal_amount
      USING ERRCODE = '22023';
  END IF;

  -- A goal met by the very first contribution completes immediately.
  IF v_initial >= p_goal_amount THEN
    v_status := 'completed';
    v_completed_at := NOW();
  END IF;

  INSERT INTO public.chains (
    started_by_user_id, started_at, kind, title, description, category,
    goal_amount, unit, current_amount, visibility, status, image_url,
    completed_at, length
  )
  VALUES (
    v_user_id, NOW(), 'goal', trim(p_title),
    NULLIF(trim(p_description), ''), p_category,
    p_goal_amount, trim(p_unit), v_initial, p_visibility, v_status,
    p_image_url, v_completed_at, 1
  )
  RETURNING id INTO v_chain_id;

  INSERT INTO public.chain_contributions (chain_id, user_id, amount, message)
  VALUES (v_chain_id, v_user_id, v_initial, NULLIF(trim(p_initial_message), ''));

  SELECT jsonb_build_object(
    'chain_id', c.id,
    'current_amount', c.current_amount,
    'goal_amount', c.goal_amount,
    'status', c.status
  ) INTO v_result
  FROM public.chains c WHERE c.id = v_chain_id;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 4. Contribute to a chain
-- ============================================================================

CREATE OR REPLACE FUNCTION public.contribute_to_chain(
  p_chain_id UUID,
  p_amount INTEGER,
  p_message TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_chain public.chains%ROWTYPE;
  v_remaining INTEGER;
  v_new_total INTEGER;
  v_status TEXT;
  v_completed_at TIMESTAMP WITH TIME ZONE := NULL;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to continue a chain.'
      USING ERRCODE = '42501';
  END IF;

  IF p_chain_id IS NULL THEN
    RAISE EXCEPTION 'Invalid chain.'
      USING ERRCODE = '22023';
  END IF;

  -- Reject non-numeric / non-positive amounts before touching any row.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than zero.'
      USING ERRCODE = '22023';
  END IF;

  IF p_message IS NOT NULL AND length(p_message) > 500 THEN
    RAISE EXCEPTION 'Please keep your note to 500 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE serialises concurrent contributions to this chain. Without it
  -- two simultaneous requests could both read the same current_amount, both
  -- pass the remaining check, and overshoot the goal.
  SELECT * INTO v_chain
  FROM public.chains
  WHERE id = p_chain_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That chain no longer exists.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_chain.status = 'completed' THEN
    RAISE EXCEPTION 'This chain is already complete. Thanks for helping!'
      USING ERRCODE = '22023';
  END IF;

  -- Private chains stay creator-only. The row lock above is released at the
  -- end of this transaction, so this check is not held open.
  IF v_chain.visibility = 'private' AND v_chain.started_by_user_id <> v_user_id THEN
    RAISE EXCEPTION 'This chain is private.'
      USING ERRCODE = '42501';
  END IF;

  v_remaining := v_chain.goal_amount - v_chain.current_amount;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'That is more than the % % remaining.', v_remaining, v_chain.unit
      USING ERRCODE = '22023';
  END IF;

  v_new_total := v_chain.current_amount + p_amount;

  IF v_new_total >= v_chain.goal_amount THEN
    v_status := 'completed';
    v_completed_at := NOW();
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO public.chain_contributions (chain_id, user_id, amount, message, image_url)
  VALUES (p_chain_id, v_user_id, p_amount, NULLIF(trim(p_message), ''), p_image_url);

  UPDATE public.chains
  SET current_amount = v_new_total,
      status = v_status,
      completed_at = v_completed_at,
      length = (SELECT count(*) + 1 FROM public.chain_contributions WHERE chain_id = p_chain_id)
  WHERE id = p_chain_id;

  v_result := jsonb_build_object(
    'chain_id', p_chain_id,
    'amount_added', p_amount,
    'current_amount', v_new_total,
    'goal_amount', v_chain.goal_amount,
    'remaining', v_chain.goal_amount - v_new_total,
    'status', v_status,
    'just_completed', (v_status = 'completed')
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. Grants
-- ============================================================================

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and Supabase's default
-- privileges additionally grant table writes to anon. Both have to be undone
-- explicitly, otherwise:
--   * anon can invoke the RPCs (they still fail the auth.uid() check inside,
--     but the limit should live in Postgres, not in a second layer)
--   * anon holds INSERT on chain_contributions (blocked only by RLS, since the
--     sole policy there is SELECT)
REVOKE EXECUTE ON FUNCTION public.contribute_to_chain(uuid, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_goal_chain(text, text, text, integer, text, text, text, integer, text) FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.chain_contributions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.chain_contributions FROM authenticated;

-- The RPCs become the only path in, and they are where validation lives.
GRANT EXECUTE ON FUNCTION public.create_goal_chain TO authenticated;
GRANT EXECUTE ON FUNCTION public.contribute_to_chain TO authenticated;

