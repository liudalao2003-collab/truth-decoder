import { detectConsecutiveRepetition } from '@/utils/text-stream-guard';

/**
 * 业务说明：在 Worker 内消费 DeepSeek 的 SSE 流，与前端 useDossierStream 的解析规则对齐，
 * 并支持节流回写 Supabase，让用户轮询时能看到「伪流式」增长。
 */
export interface DeepSeekSseOutcome {
  text: string;
  abortedByQuality: boolean;
  receivedDoneSignal: boolean;
  finishReason: string;
}

export async function accumulateDeepSeekSseResponse(
  body: ReadableStream<Uint8Array> | null,
  onProgress: (fullText: string) => void | Promise<void>,
  options?: { flushEveryMs?: number; flushCharDelta?: number }
): Promise<DeepSeekSseOutcome> {
  const flushEveryMs = options?.flushEveryMs ?? 900;
  const flushCharDelta = options?.flushCharDelta ?? 6000;

  if (!body) {
    return {
      text: '',
      abortedByQuality: false,
      receivedDoneSignal: false,
      finishReason: '',
    };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let streamDone = false;
  let lineBuffer = '';
  let localAcc = '';
  let receivedDoneSignal = false;
  let finishReason = '';
  let abortedByQuality = false;
  let lastFlushTime = 0;
  let lastEmittedLen = 0;

  const maybeFlush = async () => {
    const now = Date.now();
    if (
      now - lastFlushTime >= flushEveryMs ||
      localAcc.length - lastEmittedLen >= flushCharDelta
    ) {
      lastFlushTime = now;
      lastEmittedLen = localAcc.length;
      await onProgress(localAcc);
    }
  };

  outer: while (!streamDone) {
    const { value, done: readerDone } = await reader.read();
    streamDone = readerDone;
    if (value) {
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          if (trimmedLine.includes('[DONE]')) {
            receivedDoneSignal = true;
            continue;
          }
          try {
            const data = JSON.parse(trimmedLine.slice(6)) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };
            const delta = data.choices?.[0]?.delta?.content || '';
            const currentFinishReason = data.choices?.[0]?.finish_reason;

            if (currentFinishReason) {
              finishReason = currentFinishReason;
            }

            if (delta) {
              localAcc += delta;
              const rep = detectConsecutiveRepetition(localAcc);
              if (rep.shouldAbort) {
                void reader.cancel();
                localAcc = rep.safePrefix;
                abortedByQuality = true;
                await onProgress(localAcc);
                break outer;
              }
              await maybeFlush();
            }
          } catch {
            /* 忽略流碎片 */
          }
        }
      }
    }
  }

  await onProgress(localAcc);

  return {
    text: localAcc,
    abortedByQuality,
    receivedDoneSignal,
    finishReason,
  };
}
