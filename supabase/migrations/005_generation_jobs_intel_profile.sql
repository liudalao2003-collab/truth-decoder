-- 扩展 generation_jobs.kind，支持情报体征异步任务（与 Worker 对齐）。
-- 在 Supabase SQL Editor 执行本文件。

ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_kind_check;

ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_kind_check
  CHECK (kind IN ('dossier', 'terminal', 'intel_profile'));
