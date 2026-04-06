-- Phase 1: profiles（订阅）+ signals.owner_id + RLS
-- 在 Supabase SQL Editor 中执行本文件，或通过 CLI 迁移。

-- 1) profiles 表（与 auth.users 一对一）
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 写入仅服务角色（Webhook / 服务端 admin）；不对 authenticated 开放 insert/update

-- 2) 新用户自动建空 profile（便于 upsert 与 SELECT）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- 3) signals.owner_id（浏览器入库时写入当前用户）
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS signals_owner_id_idx ON public.signals (owner_id);

-- 4) 已有账号补建 profile（触发器不会回溯）
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;
