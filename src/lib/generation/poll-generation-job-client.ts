export type PollJobTextOutcome =
  | { outcome: 'completed'; text: string; resultMeta: unknown | null }
  | { outcome: 'failed'; text: string; errorMessage?: string }
  | { outcome: 'timeout'; text: string };

/**
 * 轮询任务并在 processing 阶段把 result_text 增量交给 onProgress（翻译等长文本场景）。
 */
export async function pollGenerationJobForText(
  jobId: string,
  accessToken: string,
  options?: {
    intervalMs?: number;
    maxWaitMs?: number;
    onProgress?: (text: string) => void;
  }
): Promise<PollJobTextOutcome> {
  const intervalMs = options?.intervalMs ?? 900;
  const maxWaitMs = options?.maxWaitMs ?? 50 * 60 * 1000;
  const deadline = Date.now() + maxWaitMs;
  let lastEmitted = '';

  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
    const res = await fetch(
      `/api/v1/generation/jobs/${jobId}?token=${encodeURIComponent(accessToken)}`,
      { credentials: 'include' }
    );
    if (!res.ok) {
      continue;
    }
    const data = (await res.json()) as {
      status: string;
      resultText: string | null;
      errorMessage: string | null;
      resultMeta: unknown | null;
    };
    const text = data.resultText ?? '';
    if (text !== lastEmitted) {
      lastEmitted = text;
      options?.onProgress?.(text);
    }
    if (data.status === 'completed') {
      return { outcome: 'completed', text, resultMeta: data.resultMeta ?? null };
    }
    if (data.status === 'failed') {
      return {
        outcome: 'failed',
        text,
        errorMessage: data.errorMessage ?? undefined,
      };
    }
  }

  return { outcome: 'timeout', text: lastEmitted };
}

/**
 * 浏览器端轮询 generation_jobs，直到任务结束或超时（供解码页情报体征入队后使用）。
 */
export async function pollGenerationJobFromBrowser(
  jobId: string,
  accessToken: string,
  options?: { intervalMs?: number; maxWaitMs?: number }
): Promise<'completed' | 'failed' | 'timeout'> {
  const intervalMs = options?.intervalMs ?? 900;
  const maxWaitMs = options?.maxWaitMs ?? 50 * 60 * 1000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
    const res = await fetch(
      `/api/v1/generation/jobs/${jobId}?token=${encodeURIComponent(accessToken)}`,
      { credentials: 'include' }
    );
    if (!res.ok) {
      continue;
    }
    const j = (await res.json()) as { status: string };
    if (j.status === 'completed') {
      return 'completed';
    }
    if (j.status === 'failed') {
      return 'failed';
    }
  }

  return 'timeout';
}
