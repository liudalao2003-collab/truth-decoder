"use client";
import { useState, useEffect, useRef } from 'react';
import { SignalRecord } from '@/types/database';
import { detectConsecutiveRepetition, chineseCharRatio, englishCharRatio } from '@/utils/text-stream-guard';
import { useBilingualCache } from '@/hooks/useBilingualCache';

const MIN_DOSSIER_LENGTH = 500;
/** EN 直出卷宗最低可接受长度，避免 500 字「假成功」与早停 */
const MIN_DOSSIER_LENGTH_EN = 3500;
const MAX_DOSSIER_RETRIES = 3;
const MAX_TRANSLATE_RETRIES = 3;
// EN 模式中文污染红线：中文字符占总字符比超过此值时触发清洗（3%）
const CHINESE_POLLUTION_THRESHOLD = 0.03;
// CN 模式英文污染红线：英文字母占总字符比超过此值时触发清洗（2%）
const ENGLISH_POLLUTION_THRESHOLD_CN = 0.02;

const QUALITY_ERROR_CN =
  '检测到模型输出异常复读，已自动截断。请稍后重新尝试生成卷宗。';
const QUALITY_ERROR_EN =
  'Abnormal repetitive output was detected and truncated. Please try generating the dossier again.';

const FINAL_FAIL_CN = '卷宗经过多次自动恢复仍失败，请稍后重试。';
const FINAL_FAIL_EN =
  'The dossier could not be generated after automatic recovery attempts. Please try again later.';

const TRANSLATE_FAIL_HINT_CN =
  '中文卷宗已生成，但自动翻译成英文未成功。请切换至 CN 查看中文卷宗，或稍后重试生成英文。';
const TRANSLATE_FAIL_HINT_EN =
  'Chinese dossier is ready; automatic English translation did not complete. Switch to CN or try again.';

const QUOTA_ERROR_CN =
  '本月暗影卷宗次数已用完。订阅 Pro 可无限生成，或于下月（UTC）重置后再试。';
const QUOTA_ERROR_EN =
  'Monthly dossier quota reached. Subscribe to Pro for unlimited generation, or try again next month (UTC).';

type ConsumeSseOutcome = {
  text: string;
  abortedByQuality: boolean;
  receivedDoneSignal: boolean;
  finishReason: string;
};

/**
 * EN 主路径：拒绝内容过滤、过短、结构不完整（未形成多段 + 终章/第四段），以便走 CN→EN 兜底。
 */
function isDossierEnAcceptable(text: string, outcome: ConsumeSseOutcome): boolean {
  if (outcome.finishReason === 'content_filter') {
    return false;
  }
  const t = text.trim();
  if (t.length < MIN_DOSSIER_LENGTH_EN) {
    return false;
  }
  const headerCount = (t.match(/^##\s+/gm) ?? []).length;
  if (headerCount < 4) {
    return false;
  }
  if (!/EPILOGUE|##\s*IV\./i.test(t)) {
    return false;
  }
  return true;
}

/**
 * 消费 OpenAI 兼容的 chat/completions SSE，带复读安检；通过 onAccumulated 驱动 UI 增量更新。
 */
async function consumeChatCompletionSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onAccumulated: (fullText: string) => void
): Promise<ConsumeSseOutcome> {
  const decoder = new TextDecoder('utf-8');
  let streamDone = false;
  let lineBuffer = '';
  let localAcc = '';
  let receivedDoneSignal = false;
  let finishReason = '';
  let abortedByQuality = false;

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
            const data = JSON.parse(trimmedLine.slice(6));
            const delta = data.choices[0]?.delta?.content || '';
            const currentFinishReason = data.choices[0]?.finish_reason;

            if (currentFinishReason) {
              finishReason = currentFinishReason;
            }

            if (delta) {
              localAcc += delta;
              const rep = detectConsecutiveRepetition(localAcc);
              if (rep.shouldAbort) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔴 [模块_崩溃] -> 原因: SSE 流检测到异常复读，已掐断');
                }
                void reader.cancel();
                localAcc = rep.safePrefix;
                abortedByQuality = true;
                onAccumulated(localAcc);
                break outer;
              }
              onAccumulated(localAcc);
            }
          } catch {
            /* 忽略流碎片 */
          }
        }
      }
    }
  }

  return {
    text: localAcc,
    abortedByQuality,
    receivedDoneSignal,
    finishReason,
  };
}

/**
 * EN 模式中文污染清洗器：对已生成但含中文残留的 EN 文本，发起一次专项翻译清洗。
 * 最多执行一次，网络异常或输出不合格时静默保留原文，保证 UI 不白屏不崩溃。
 *
 * V9.4 修复：移除 onUpdate 参数，改用内部局部变量 localBuf 积累清洗结果。
 * 只有在清洗完全成功后，调用方才一次性将结果写入 cache.en，
 * 避免"流了一半后失败回滚"导致 cache.en 经历空→部分清洁→恢复污染的状态混乱，
 * 从而防止脏数据被 sync 写入数据库。
 */
async function runEnCleanupTranslation(
  pollutedText: string,
  onStatus: (msg: string | null) => void
): Promise<string> {
  onStatus('Language purity guard: cleaning up mixed-language content…');
  if (process.env.NODE_ENV === 'development') {
    console.log('🟡 [模块_异步] -> 目标: 检测到 EN 输出含中文残留，启动语言纯洁性清洗通道');
  }
  try {
    const res = await fetch('/api/v1/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: pollutedText, targetLang: 'en' }),
    });
    if (!res.ok || !res.body) return pollutedText;

    // 使用局部缓冲积累清洗结果，不直接更新 cache，防止中间态污染状态树
    let localBuf = '';
    const reader = res.body.getReader();
    const cleanOutcome = await consumeChatCompletionSseStream(reader, (full) => {
      localBuf = full;
    });

    // 清洗结果不合格（复读截断或内容过短）：静默回退到原文
    if (cleanOutcome.abortedByQuality || localBuf.trim().length < 200) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因: 清洗翻译输出不合格，保留原污染文本');
      }
      return pollutedText;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [模块_成功] -> 产物: EN 语言纯洁性清洗完成，中文残留已清除');
    }
    return localBuf;
  } catch {
    // 网络异常：静默保留原文
    return pollutedText;
  }
}

/**
 * CN 模式英文污染清洗器：对已生成但含英文残留的 CN 文本，发起一次专项翻译清洗。
 * 逻辑与 runEnCleanupTranslation 完全对称，调用 /api/v1/translate 传 targetLang: 'cn'。
 * 清洗失败或输出不合格时静默保留原文，保证 UI 不白屏不崩溃。
 */
async function runCnCleanupTranslation(
  pollutedText: string,
  onStatus: (msg: string | null) => void
): Promise<string> {
  onStatus('语言纯洁性守卫：正在清洗英文残留…');
  if (process.env.NODE_ENV === 'development') {
    console.log('🟡 [模块_异步] -> 目标: 检测到 CN 输出含英文残留，启动语言纯洁性清洗通道');
  }
  try {
    const res = await fetch('/api/v1/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: pollutedText, targetLang: 'cn' }),
    });
    if (!res.ok || !res.body) return pollutedText;

    // 使用局部缓冲积累清洗结果，不直接更新 cache，防止中间态污染状态树
    let localBuf = '';
    const reader = res.body.getReader();
    const cleanOutcome = await consumeChatCompletionSseStream(reader, (full) => {
      localBuf = full;
    });

    // 清洗结果不合格（复读截断或内容过短）：静默回退到原文
    if (cleanOutcome.abortedByQuality || localBuf.trim().length < 200) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因: CN 清洗翻译输出不合格，保留原污染文本');
      }
      return pollutedText;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [模块_成功] -> 产物: CN 语言纯洁性清洗完成，英文残留已清除');
    }
    return localBuf;
  } catch {
    // 网络异常：静默保留原文
    return pollutedText;
  }
}

/**
 * 按 ## 标题边界分割卷宗文本，返回多个 chunk，每块包含其标题行。
 * 确保每块的 token 量可控（约 1500-2500 tokens），避免单次翻译超出 max_tokens 8192 上限。
 */
function splitDossierIntoSections(text: string): string[] {
  // 以 \n## 作为段落分隔符，保留标题行在每块开头
  const parts = text.split(/(?=\n## )/);
  // 过滤掉纯空行块，并去除首尾空白
  const chunks = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  // 若分割失败（文本中无 ## 标题），降级为整块处理
  return chunks.length > 0 ? chunks : [text];
}

/**
 * 对单个 chunk 调用 /api/v1/translate 并返回完整译文。
 * 不做 UI 更新（由调用方 translateDossierInChunks 负责），保持纯函数。
 */
async function translateOneChunk(
  chunk: string,
  targetLang: 'cn' | 'en'
): Promise<string> {
  const res = await fetch('/api/v1/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content: chunk, targetLang }),
  });
  if (!res.ok || !res.body) {
    const errData = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(errData.error || `网关物理阻断: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const outcome = await consumeChatCompletionSseStream(reader, () => {});
  return outcome.text;
}

/**
 * 核心分段翻译引擎：将卷宗按 ## 分割后逐段翻译，
 * 每段完成后立即通过 onProgress 回调更新 UI，实现逐段刷入效果。
 * 每段输入 ≤ 2500 tokens，输出 ≤ 3500 tokens，绝对不触及 max_tokens 8192。
 */
async function translateDossierInChunks(
  sourceText: string,
  targetLang: 'cn' | 'en',
  onProgress: (accumulated: string) => void
): Promise<string> {
  const chunks = splitDossierIntoSections(sourceText);
  if (process.env.NODE_ENV === 'development') {
    console.log(`🟡 [模块_异步] -> 目标: 分段翻译启动，共 ${chunks.length} 个段落`);
  }

  let accumulated = '';
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟡 [模块_异步] -> 目标: 翻译段落 ${i + 1}/${chunks.length}，长度: ${chunk.length} 字符`);
    }
    const translatedChunk = await translateOneChunk(chunk, targetLang);
    accumulated = accumulated
      ? `${accumulated}\n\n${translatedChunk}`
      : translatedChunk;
    onProgress(accumulated);
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔵 [模块_成功] -> 产物: 段落 ${i + 1}/${chunks.length} 翻译完成`);
    }
  }

  return accumulated;
}

/**
 * 解析卷宗网关响应：403 且 code 为额度用尽时返回 quota，避免误触发重试。
 */
async function postDossierApi(body: Record<string, unknown>): Promise<
  | { kind: 'quota' }
  | { kind: 'bad' }
  | { kind: 'ok'; res: Response }
> {
  const res = await fetch('/api/v1/dossier', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (res.status === 403) {
    try {
      const j = (await res.json()) as { code?: string };
      if (j.code === 'DOSSIER_QUOTA_EXCEEDED') {
        return { kind: 'quota' };
      }
    } catch {
      /* 忽略非 JSON */
    }
    return { kind: 'bad' };
  }
  if (!res.ok || !res.body) {
    return { kind: 'bad' };
  }
  return { kind: 'ok', res };
}

export interface UseDossierStreamOptions {
  /** 403 额度用尽时由页面弹出升级或刷新权益 */
  onQuotaExceeded?: () => void;
  /** 主路径成功 sync 后刷新剩余次数 */
  onDossierSynced?: () => void;
}

export function useDossierStream(
  signal: SignalRecord | null,
  lang: 'cn' | 'en',
  options?: UseDossierStreamOptions
) {
  const { onQuotaExceeded, onDossierSynced } = options ?? {};
  const [cache, setCache] = useState<Record<'cn' | 'en', string>>({ cn: '', en: '' });
  const [isStreamingDossier, setIsStreamingDossier] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [streamQualityError, setStreamQualityError] = useState<string | null>(null);
  const [dossierRecoveryStatus, setDossierRecoveryStatus] = useState<string | null>(null);
  const { resolveOrCreate } = useBilingualCache(signal?.id ?? null, 'dossier');

  const cacheRef = useRef<Record<'cn' | 'en', string>>({ cn: '', en: '' });

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  useEffect(() => {
    if (signal?.dossier_content) {
      if (typeof signal.dossier_content === 'string') {
        setCache(prev => ({ ...prev, cn: signal.dossier_content as string }));
      } else {
        setCache({
          cn: signal.dossier_content.cn || '',
          en: signal.dossier_content.en || ''
        });
      }
      setStreamQualityError(null);
    }
  }, [signal?.dossier_content]);

  useEffect(() => {
    const triggerTranslation = async () => {
      if (!signal?.id || isStreamingDossier || isTranslating) return;

      const currentText = cache[lang];
      const sourceLang = lang === 'cn' ? 'en' : 'cn';
      const sourceText = cache[sourceLang];

      if (!currentText && sourceText) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🟢 [模块_发起] -> 动作/参数: 探测到 [${lang}] 缓存击穿，启动分段懒翻译协议`);
        }
        // 翻译开始时立即清空目标语言缓存，防止旧内容透过遮罩残留显示
        setCache((prev) => ({ ...prev, [lang]: '' }));
        setIsTranslating(true);
        setStreamQualityError(null);

        try {
          const fullTranslatedText = await resolveOrCreate({
            sourceLang,
            targetLang: lang,
            sourceContent: sourceText,
            // produce 使用分段翻译：每段独立调用 /api/v1/translate，避免超 max_tokens 8192
            produce: async () => {
              const result = await translateDossierInChunks(
                sourceText,
                lang,
                (accumulated) => {
                  // 每段完成后实时刷新 UI（遮罩移除后可见逐段渲染效果）
                  setCache((prev) => ({ ...prev, [lang]: accumulated }));
                }
              );
              return result;
            },
          });

          // resolveOrCreate 返回后（可能来自缓存），确保 UI 最终态一致
          setCache((prev) => ({ ...prev, [lang]: fullTranslatedText }));

          const merged: Record<'cn' | 'en', string> = {
            ...cacheRef.current,
            [lang]: fullTranslatedText,
          };

          fetch('/api/v1/dossier/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: signal.id, dossier_content: merged }),
          }).catch((e) => {
            if (process.env.NODE_ENV === 'development') console.log('🔴 [同步失败] ->', e);
          });

          if (process.env.NODE_ENV === 'development') {
            console.log('🔵 [模块_成功] -> 产物: 分段翻译全部完成，已触发静默落盘');
          }
        } catch (err: unknown) {
          if (process.env.NODE_ENV === 'development') console.log('🔴 [翻译崩塌] ->', err);
        } finally {
          setIsTranslating(false);
        }
      }
    };

    void triggerTranslation();
  }, [lang, cache, signal?.id, isTranslating, isStreamingDossier, resolveOrCreate]);

  const startDossierStream = async () => {
    if (!signal?.raw_content || isStreamingDossier) return;

    const rawContent = signal.raw_content;

    setIsStreamingDossier(true);
    setIsTruncated(false);
    setStreamQualityError(null);
    setDossierRecoveryStatus(null);
    setCache((prev) => ({ ...prev, [lang]: '' }));

    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 [模块_发起] -> 动作/参数: 激活暗影卷宗流式生成 (Lang: ${lang})`);
    }

    const recoveryRetrySame = lang === 'cn' ? '正在重新尝试生成卷宗…' : 'Retrying dossier generation…';

    let overallTruncated = false;
    let primarySucceeded = false;

    try {
      for (let attempt = 0; attempt < MAX_DOSSIER_RETRIES; attempt++) {
        if (attempt > 0) {
          setDossierRecoveryStatus(recoveryRetrySame);
        }
        setCache((prev) => ({ ...prev, [lang]: '' }));

        let res: Response;
        try {
          const out = await postDossierApi({
            rawContent,
            lang,
            retryAttempt: attempt,
          });
          if (out.kind === 'quota') {
            setStreamQualityError(
              lang === 'cn' ? QUOTA_ERROR_CN : QUOTA_ERROR_EN
            );
            onQuotaExceeded?.();
            return;
          }
          if (out.kind === 'bad') {
            continue;
          }
          res = out.res;
        } catch {
          continue;
        }

        const streamBody = res.body;
        if (!streamBody) {
          continue;
        }
        const reader = streamBody.getReader();
        const targetLang = lang;
        const outcome = await consumeChatCompletionSseStream(reader, (full) => {
          setCache((prev) => ({ ...prev, [targetLang]: full }));
        });

        if (outcome.abortedByQuality) {
          continue;
        }

        if (lang === 'en') {
          if (!isDossierEnAcceptable(outcome.text, outcome)) {
            continue;
          }
        } else if (outcome.text.trim().length < MIN_DOSSIER_LENGTH) {
          continue;
        }

        primarySucceeded = true;
        if (outcome.finishReason === 'length' || !outcome.receivedDoneSignal) {
          overallTruncated = true;
        }
        // EN 模式语言纯洁性守卫：直接生成的 EN 卷宗若含中文残留，触发一次清洗
        if (lang === 'en' && chineseCharRatio(outcome.text) > CHINESE_POLLUTION_THRESHOLD) {
          const cleanedText = await runEnCleanupTranslation(
            outcome.text,
            setDossierRecoveryStatus
          );
          setCache((prev) => ({ ...prev, en: cleanedText }));
        }
        // CN 模式语言纯洁性守卫：直接生成的 CN 卷宗若含英文残留超标，触发一次清洗
        if (lang === 'cn' && englishCharRatio(outcome.text) > ENGLISH_POLLUTION_THRESHOLD_CN) {
          const cleanedText = await runCnCleanupTranslation(
            outcome.text,
            setDossierRecoveryStatus
          );
          setCache((prev) => ({ ...prev, cn: cleanedText }));
        }
        break;
      }

      if (!primarySucceeded && lang === 'en') {
        setCache((prev) => ({ ...prev, en: '' }));
        setDossierRecoveryStatus(
          'Switching pipeline: generating in Chinese, then translating to English…'
        );

        cnFallback: for (let attempt = 0; attempt < MAX_DOSSIER_RETRIES; attempt++) {
          if (attempt > 0) {
            setDossierRecoveryStatus('Retrying Chinese generation…');
          }
          setCache((prev) => ({ ...prev, cn: '' }));

          let res: Response;
          try {
            const out = await postDossierApi({
              rawContent,
              lang: 'cn',
              retryAttempt: attempt,
            });
            if (out.kind === 'quota') {
              // 此分支仅在主界面语言为 en 时进入，固定英文提示
              setStreamQualityError(QUOTA_ERROR_EN);
              onQuotaExceeded?.();
              return;
            }
            if (out.kind === 'bad') {
              continue;
            }
            res = out.res;
          } catch {
            continue;
          }

          const streamBodyCn = res.body;
          if (!streamBodyCn) {
            continue;
          }

          const reader = streamBodyCn.getReader();
          const outcome = await consumeChatCompletionSseStream(reader, (full) => {
            setCache((prev) => ({ ...prev, cn: full }));
          });

          if (outcome.abortedByQuality || outcome.text.trim().length < MIN_DOSSIER_LENGTH) {
            continue;
          }

          const cnText = outcome.text;
          if (outcome.finishReason === 'length' || !outcome.receivedDoneSignal) {
            overallTruncated = true;
          }

          let translateOk = false;
          for (let t = 0; t < MAX_TRANSLATE_RETRIES; t++) {
            if (t > 0) {
              setDossierRecoveryStatus('Retrying English translation…');
            }
            setCache((prev) => ({ ...prev, en: '' }));

            let enText = '';
            try {
              // 使用分段翻译替换单次全量翻译，彻底规避 max_tokens 8192 截断
              enText = await translateDossierInChunks(
                cnText,
                'en',
                (accumulated) => {
                  setCache((prev) => ({ ...prev, en: accumulated }));
                }
              );
            } catch {
              continue;
            }

            if (enText.trim().length < MIN_DOSSIER_LENGTH) {
              continue;
            }

            translateOk = true;
            // EN 模式语言纯洁性守卫第二道：CN→EN 翻译结果若仍含中文残留，触发二次清洗
            if (chineseCharRatio(enText) > CHINESE_POLLUTION_THRESHOLD) {
              const cleanedText = await runEnCleanupTranslation(
                enText,
                setDossierRecoveryStatus
              );
              setCache((prev) => ({ ...prev, en: cleanedText }));
            }
            break;
          }

          if (translateOk) {
            primarySucceeded = true;
          } else {
            // 此处仅在 lang === 'en' 的 CN→EN 兜底分支内，TypeScript 已收窄 lang，固定英文提示
            setStreamQualityError(TRANSLATE_FAIL_HINT_EN);
            primarySucceeded = true;
          }
          break cnFallback;
        }
      }

      if (!primarySucceeded) {
        setStreamQualityError(lang === 'cn' ? FINAL_FAIL_CN : FINAL_FAIL_EN);
        setIsTruncated(true);
      } else {
        setIsTruncated(overallTruncated);
        setCache((finalCache) => {
          fetch('/api/v1/dossier/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ id: signal.id, dossier_content: finalCache }),
          })
            .then(() => {
              onDossierSynced?.();
            })
            .catch(() => {});
          return finalCache;
        });
      }
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.log('🔴 [流式中断] ->', err);
      setStreamQualityError(lang === 'cn' ? FINAL_FAIL_CN : FINAL_FAIL_EN);
      setIsTruncated(true);
    } finally {
      setDossierRecoveryStatus(null);
      setIsStreamingDossier(false);
    }
  };

  return {
    dossierContent: cache[lang],
    isStreamingDossier,
    isTranslating,
    isTruncated,
    streamQualityError,
    dossierRecoveryStatus,
    startDossierStream
  };
}
