/**
 * 流式文本安检：检测尾部连续重复子串（模型复读崩溃时掐断用）
 *
 * 仅在全文末尾的 tailWindow 内扫描，避免长文全量扫描开销。
 * 规则：同一子串连续出现 ≥ minRepeats 次则视为异常，返回重复开始前的安全前缀。
 */

export interface StreamRepetitionResult {
  shouldAbort: boolean;
  safePrefix: string;
}

export interface DetectRepetitionOptions {
  /** 只扫描全文最后 N 个字符，默认 4000 */
  tailWindow?: number;
  /** 连续重复次数阈值，默认 5（即同一段连续念 5 遍） */
  minRepeats?: number;
  /** 重复单元最小长度（字符数），默认 2，降低单字符误报 */
  minUnitLen?: number;
  /** 重复单元最大长度，默认 120 */
  maxUnitLen?: number;
}

const DEFAULT_TAIL_WINDOW = 4000;
const DEFAULT_MIN_REPEATS = 5;
const DEFAULT_MIN_UNIT_LEN = 2;
const DEFAULT_MAX_UNIT_LEN = 120;

export function detectConsecutiveRepetition(
  fullText: string,
  options?: DetectRepetitionOptions
): StreamRepetitionResult {
  const tailWindow = options?.tailWindow ?? DEFAULT_TAIL_WINDOW;
  const minRepeats = options?.minRepeats ?? DEFAULT_MIN_REPEATS;
  const minUnitLen = options?.minUnitLen ?? DEFAULT_MIN_UNIT_LEN;
  const maxUnitLen = options?.maxUnitLen ?? DEFAULT_MAX_UNIT_LEN;

  if (!fullText || fullText.length < minUnitLen * minRepeats) {
    return { shouldAbort: false, safePrefix: fullText };
  }

  const sliceOffset = Math.max(0, fullText.length - tailWindow);
  const slice = fullText.slice(sliceOffset);

  const maxLen = Math.min(
    maxUnitLen,
    Math.floor(slice.length / minRepeats)
  );

  for (let len = maxLen; len >= minUnitLen; len--) {
    if (slice.length < len * minRepeats) {
      continue;
    }

    const unit = slice.slice(-len);
    if (unit.trim().length < minUnitLen) {
      continue;
    }

    let count = 0;
    let pos = slice.length;
    while (pos >= len) {
      const chunk = slice.slice(pos - len, pos);
      if (chunk === unit) {
        count += 1;
        pos -= len;
      } else {
        break;
      }
    }

    if (count >= minRepeats) {
      const repeatStartInFull = sliceOffset + pos;
      return {
        shouldAbort: true,
        safePrefix: fullText.slice(0, repeatStartInFull),
      };
    }
  }

  return { shouldAbort: false, safePrefix: fullText };
}

// ─────────────────────────────────────────────
// 语言纯洁性检测工具（EN 模式中文污染防御层）
// ─────────────────────────────────────────────

/**
 * 中文字符正则：覆盖基本汉字区（CJK Unified Ideographs）
 * 及扩展 A 区，足以捕获所有常见汉字。
 * 注意：每次调用 .test() 前必须重置 lastIndex（或使用非 /g 版本），
 * 此处专门提供两个独立的正则实例以规避状态污染。
 */
const CHINESE_TEST_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const CHINESE_MATCH_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/**
 * 判断文本中是否含有中文字符。
 * 用于快速检测 EN 模式输出是否被汉字污染。
 */
export function hasChinese(text: string): boolean {
  if (!text) return false;
  return CHINESE_TEST_REGEX.test(text);
}

/**
 * 计算文本中中文字符占总字符数的比例（0~1）。
 * 比例 > 0.03（即 3%）时视为"中文污染超标"，需触发清洗。
 */
export function chineseCharRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  const matches = text.match(CHINESE_MATCH_REGEX);
  return matches ? matches.length / text.length : 0;
}

// ─────────────────────────────────────────────
// 英文污染检测工具（CN 模式英文字母防御层）
// ─────────────────────────────────────────────

/** 英文字母正则：覆盖 a-z / A-Z，用于检测 CN 模式输出中的英文夹杂 */
const ENGLISH_MATCH_REGEX = /[a-zA-Z]/g;

/**
 * 计算文本中英文字母占总字符数的比例（0~1）。
 * 比例 > 0.02（即 2%）时视为"英文污染超标"，触发 CN 清洗通道。
 * 注：[[::]] 格式符号本身不含字母，不会误计入比例。
 */
export function englishCharRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  const matches = text.match(ENGLISH_MATCH_REGEX);
  return matches ? matches.length / text.length : 0;
}
