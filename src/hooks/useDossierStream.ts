"use client";
import { useState, useEffect, useRef } from 'react';
import { SignalRecord } from '@/types/database';
import { detectConsecutiveRepetition, chineseCharRatio } from '@/utils/text-stream-guard';

const MIN_DOSSIER_LENGTH = 500;
const MAX_DOSSIER_RETRIES = 3;
const MAX_TRANSLATE_RETRIES = 3;
// EN 模式中文污染红线：中文字符占总字符比超过此值时触发清洗（3%）
const CHINESE_POLLUTION_THRESHOLD = 0.03;

const QUALITY_ERROR_CN =
  '检测到模型输出异常复读，已自动截断。请稍后重新尝试生成卷宗。';
const QUALITY_ERROR_EN =
  'Abnormal repetitive output was detected and truncated. Please try generating the dossier again.';

const FINAL_FAIL_CN = '卷宗经过多次自动恢复仍失败，请稍后重试。';
const FINAL_FAIL_EN =
  'The dossier could not be generated after automatic recovery attempts. Please try again later.';

const TRANSLATE_FAIL_HINT =
  '中文卷宗已生成，但自动翻译成英文未成功。请切换至 CN 查看中文卷宗，或稍后重试生成英文。 / Chinese dossier is ready; automatic English translation did not complete. Switch to CN or try again.';

type ConsumeSseOutcome = {
  text: string;
  abortedByQuality: boolean;
  receivedDoneSignal: boolean;
  finishReason: string;
};

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

export function useDossierStream(signal: SignalRecord | null, lang: 'cn' | 'en') {
  const [cache, setCache] = useState<Record<'cn' | 'en', string>>({ cn: '', en: '' });
  const [isStreamingDossier, setIsStreamingDossier] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [streamQualityError, setStreamQualityError] = useState<string | null>(null);
  const [dossierRecoveryStatus, setDossierRecoveryStatus] = useState<string | null>(null);

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
          console.log(`🟡 [模块_异步] -> 目标: 探测到 [${lang}] 缓存击穿，启动流式懒翻译补全协议`);
        }
        setIsTranslating(true);
        setStreamQualityError(null);
        let translationAbortedByQuality = false;

        try {
          const res = await fetch('/api/v1/translate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ content: sourceText, targetLang: lang }),
          });

          if (!res.ok || !res.body) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `网关物理阻断: HTTP ${res.status}`);
          }

          const reader = res.body.getReader();

          const outcome = await consumeChatCompletionSseStream(reader, (full) => {
            setCache((prev) => ({ ...prev, [lang]: full }));
          });

          if (outcome.abortedByQuality) {
            translationAbortedByQuality = true;
            setStreamQualityError(lang === 'cn' ? QUALITY_ERROR_CN : QUALITY_ERROR_EN);
          }

          const fullTranslatedText = outcome.text;

          const merged: Record<'cn' | 'en', string> = {
            ...cacheRef.current,
            [lang]: fullTranslatedText
          };

          fetch('/api/v1/dossier/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ id: signal.id, dossier_content: merged }),
          }).catch((e) => {
            if (process.env.NODE_ENV === 'development') console.log('🔴 [同步失败] ->', e);
          });

          if (translationAbortedByQuality && process.env.NODE_ENV === 'development') {
            console.log('🟡 [模块_异步] -> 懒翻译因复读截断，已用安全前缀同步');
          }
        } catch (err: unknown) {
          if (process.env.NODE_ENV === 'development') console.log('🔴 [翻译崩塌] ->', err);
        } finally {
          setIsTranslating(false);
        }
      }
    };

    void triggerTranslation();
  }, [lang, cache, signal?.id, isTranslating, isStreamingDossier]);

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
          res = await fetch('/api/v1/dossier', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ rawContent, lang, retryAttempt: attempt }),
          });
        } catch {
          continue;
        }

        if (!res.ok || !res.body) {
          continue;
        }

        const reader = res.body.getReader();
        const targetLang = lang;
        const outcome = await consumeChatCompletionSseStream(reader, (full) => {
          setCache((prev) => ({ ...prev, [targetLang]: full }));
        });

        if (outcome.abortedByQuality) {
          continue;
        }
        if (outcome.text.trim().length < MIN_DOSSIER_LENGTH) {
          continue;
        }

        primarySucceeded = true;
        if (outcome.finishReason === 'length' || !outcome.receivedDoneSignal) {
          overallTruncated = true;
        }
        // EN 模式语言纯洁性守卫第一道：直接生成的 EN 卷宗若含中文残留，触发一次清洗
        if (lang === 'en' && chineseCharRatio(outcome.text) > CHINESE_POLLUTION_THRESHOLD) {
          const cleanedText = await runEnCleanupTranslation(
            outcome.text,
            setDossierRecoveryStatus
          );
          setCache((prev) => ({ ...prev, en: cleanedText }));
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
            res = await fetch('/api/v1/dossier', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ rawContent, lang: 'cn', retryAttempt: attempt }),
            });
          } catch {
            continue;
          }

          if (!res.ok || !res.body) {
            continue;
          }

          const reader = res.body.getReader();
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

            let tres: Response;
            try {
              tres = await fetch('/api/v1/translate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ content: cnText, targetLang: 'en' }),
              });
            } catch {
              continue;
            }

            if (!tres.ok || !tres.body) {
              continue;
            }

            const treader = tres.body.getReader();
            const tOutcome = await consumeChatCompletionSseStream(treader, (full) => {
              setCache((prev) => ({ ...prev, en: full }));
            });

            if (tOutcome.abortedByQuality || tOutcome.text.trim().length < MIN_DOSSIER_LENGTH) {
              continue;
            }

            translateOk = true;
            if (tOutcome.finishReason === 'length' || !tOutcome.receivedDoneSignal) {
              overallTruncated = true;
            }
            // EN 模式语言纯洁性守卫第二道：CN→EN 翻译结果若仍含中文残留，触发二次清洗
            // 这是截图中「复合型中介机构」等混排问题的核心拦截点
            if (chineseCharRatio(tOutcome.text) > CHINESE_POLLUTION_THRESHOLD) {
              const cleanedText = await runEnCleanupTranslation(
                tOutcome.text,
                setDossierRecoveryStatus
              );
              setCache((prev) => ({ ...prev, en: cleanedText }));
            }
            break;
          }

          if (translateOk) {
            primarySucceeded = true;
          } else {
            setStreamQualityError(TRANSLATE_FAIL_HINT);
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
          }).catch(() => {});
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
