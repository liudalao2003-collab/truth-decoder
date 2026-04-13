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
