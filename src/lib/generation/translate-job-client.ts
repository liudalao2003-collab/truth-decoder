import {
  pollGenerationJobForText,
  type PollJobTextOutcome,
} from '@/lib/generation/poll-generation-job-client';

export interface TranslateJobResult {
  text: string;
  resultMeta: unknown | null;
}

/**
 * 浏览器端：暗影卷宗懒翻译改走异步队列 + 轮询（与 Worker 对齐，不占用 Vercel 长连接）。
 */
export async function runTranslateViaGenerationJob(
  content: string,
  targetLang: 'cn' | 'en',
  onProgress?: (text: string) => void
): Promise<TranslateJobResult> {
  const res = await fetch('/api/v1/generation/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      kind: 'translate',
      payload: { content, targetLang },
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `翻译入队失败: HTTP ${res.status}`);
  }

  const j = (await res.json()) as { id?: string; accessToken?: string; skipped?: boolean };
  if (j.skipped || !j.id || !j.accessToken) {
    throw new Error('翻译任务入队响应异常');
  }

  const poll: PollJobTextOutcome = await pollGenerationJobForText(j.id, j.accessToken, {
    onProgress,
    maxWaitMs: 50 * 60 * 1000,
  });

  if (poll.outcome === 'completed') {
    return { text: poll.text, resultMeta: poll.resultMeta ?? null };
  }
  if (poll.outcome === 'failed') {
    throw new Error(poll.errorMessage ?? '翻译任务失败');
  }
  throw new Error('翻译超时，请稍后重试');
}
