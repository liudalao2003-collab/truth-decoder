-- Phase 3: PRO Terminal 免费额度（UTC 自然月），计数在成功流式结束后由服务端 RPC 递增。

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terminal_quota_period text,
  ADD COLUMN IF NOT EXISTS terminal_quota_used int NOT NULL DEFAULT 0;

-- Pro 用户直接返回；非 Pro 按 UTC 月重置并递增 terminal_quota_used（仅 service_role 可调用）
CREATE OR REPLACE FUNCTION public.increment_terminal_quota_if_needed(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_period text;
  v_used int;
  v_now text;
BEGIN
  SELECT subscription_status, terminal_quota_period, terminal_quota_used
  INTO v_status, v_period, v_used
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_status IN ('active', 'trialing') THEN
    RETURN;
  END IF;

  v_now := to_char((timezone('utc', now()))::date, 'YYYY-MM');

  IF v_period IS DISTINCT FROM v_now THEN
    UPDATE public.profiles
    SET terminal_quota_period = v_now,
        terminal_quota_used = 1,
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET terminal_quota_used = COALESCE(v_used, 0) + 1,
        updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_terminal_quota_if_needed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_terminal_quota_if_needed(uuid) TO service_role;
