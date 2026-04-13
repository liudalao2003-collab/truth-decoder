-- 异步生成任务队列：将 DeepSeek 长跑从 Vercel Serverless 迁出，由独立 Worker 消费。
-- 在 Supabase SQL Editor 执行本文件后，本地/服务器运行: npm run worker:generation

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('dossier', 'terminal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_text text,
  error_message text,
  result_meta jsonb,
  access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS generation_jobs_status_created_idx
  ON public.generation_jobs (status, created_at);

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

-- 仅服务端 service_role / Worker 访问；浏览器一律走 Next API（Cookie 或 access_token）
CREATE POLICY "generation_jobs_no_direct_client"
  ON public.generation_jobs
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.claim_generation_job()
RETURNS SETOF public.generation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.generation_jobs gj
  SET
    status = 'processing',
    started_at = COALESCE(gj.started_at, now()),
    updated_at = now()
  WHERE gj.id = (
    SELECT id FROM public.generation_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING gj.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_generation_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_generation_job() TO service_role;
