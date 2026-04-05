import { SignalRecord, BilingualData, BilingualDossier } from '@/types/database';
import { RADAR_AXIS_ORDER, radarLabels } from '@/lib/intel-profile-ui';
import type { TerminalMessage } from '@/types';

/** 导出分节语义键（与文案语言无关，供 PDF/长图配色） */
export type IntelExportSectionKey =
  | 'verdict'
  | 'hard_facts'
  | 'intel'
  | 'intel_radar'
  | 'rationale'
  | 'stakeholders'
  | 'verification'
  | 'audit'
  | 'source'
  | 'dossier'
  | 'terminal';

/** 导出 PDF / 长图 / Markdown 的扁平块，便于逐块换页与渲染 */
export type IntelExportBlock =
  | { type: 'doc_title'; text: string }
  | { type: 'meta'; signalId: string; generatedAt: string }
  | { type: 'h2'; text: string; sectionKey: IntelExportSectionKey }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'bullets'; items: string[] };

export type IntelExportMode = 'brief' | 'full';

export interface BuildIntelExportBlocksOptions {
  /** brief：与旧版 Markdown 简报同范围（无原文/卷宗/终端）；full：整案导出 */
  mode?: IntelExportMode;
  /** 前端流式卷宗优先于库内字段（非空即用），仅 full 模式有效 */
  dossierText?: string | null;
  includeTerminal?: boolean;
  terminalMessages?: TerminalMessage[];
}

function factsForLang(
  h: SignalRecord['hard_facts'],
  lang: 'cn' | 'en'
): string[] {
  if (Array.isArray(h)) return h;
  return (h as BilingualData)?.[lang] ?? [];
}

function dossierFromRecord(record: SignalRecord, lang: 'cn' | 'en'): string {
  const dc = record.dossier_content;
  if (dc == null) return '';
  if (typeof dc === 'string') return dc;
  const b = dc as BilingualDossier;
  return b[lang] ?? b.cn ?? b.en ?? '';
}

/**
 * 合并客户端卷宗与库内卷宗：客户端非空则优先（与屏幕一致）。
 */
export function resolveDossierTextForExport(
  record: SignalRecord,
  lang: 'cn' | 'en',
  clientDossier?: string | null
): string {
  const trimmed = clientDossier?.trim() ?? '';
  if (trimmed.length > 0) return trimmed;
  return dossierFromRecord(record, lang);
}

function terminalForExport(
  include: boolean | undefined,
  messages: TerminalMessage[] | undefined
): TerminalMessage[] {
  if (!include || !messages?.length) return [];
  return messages.filter((m) => m.role === 'user' || m.role === 'assistant');
}

/**
 * 构建全案导出块：判决、硬事实、体征、原文、卷宗、可选终端。
 */
export function buildIntelExportBlocks(
  record: SignalRecord,
  lang: 'cn' | 'en',
  options: BuildIntelExportBlocksOptions = {}
): IntelExportBlock[] {
  const mode = options.mode ?? 'full';
  const blocks: IntelExportBlock[] = [];
  const dossierText = resolveDossierTextForExport(
    record,
    lang,
    options.dossierText
  );
  const terminalSlice =
    mode === 'full'
      ? terminalForExport(
          options.includeTerminal,
          options.terminalMessages
        )
      : [];

  blocks.push({
    type: 'doc_title',
    text:
      mode === 'brief'
        ? 'TruthDecoder · Brief'
        : 'TruthDecoder · Full export',
  });
  blocks.push({
    type: 'meta',
    signalId: record.id,
    generatedAt: new Date().toISOString(),
  });

  const bilingual = record.metadata?.bilingual;
  const verdict =
    bilingual && typeof bilingual === 'object'
      ? bilingual[lang]
      : record.verdict;

  blocks.push({
    type: 'h2',
    text: mode === 'brief' ? 'Verdict' : lang === 'cn' ? '最终判决' : 'Verdict',
    sectionKey: 'verdict',
  });
  blocks.push({ type: 'p', text: String(verdict ?? '') });

  const facts = factsForLang(record.hard_facts, lang);
  if (facts.length > 0) {
    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '硬事实' : 'Hard facts',
      sectionKey: 'hard_facts',
    });
    blocks.push({
      type: 'bullets',
      items: facts.map((f, i) => `${i + 1}. ${f}`),
    });
  }

  const p = record.metadata?.intelProfile;
  if (!p) {
    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '情报体征' : 'Intel signature',
      sectionKey: 'intel',
    });
    blocks.push({
      type: 'p',
      text:
        lang === 'cn'
          ? '（本条暂无情报体征）'
          : '(No intel signature on this signal)',
    });
  } else {
    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '情报体征 · 雷达' : 'Intel signature · Radar',
      sectionKey: 'intel_radar',
    });
    blocks.push({
      type: 'bullets',
      items: RADAR_AXIS_ORDER.map(
        (k) => `${radarLabels(k, lang)}: ${p.radar[k]}`
      ),
    });

    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '体征依据' : 'Rationale',
      sectionKey: 'rationale',
    });
    for (const k of RADAR_AXIS_ORDER) {
      const bullets = lang === 'cn' ? p.rationale[k].cn : p.rationale[k].en;
      blocks.push({ type: 'h3', text: radarLabels(k, lang) });
      blocks.push({ type: 'bullets', items: bullets.map((b) => b) });
    }

    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '利益相关方' : 'Stakeholders',
      sectionKey: 'stakeholders',
    });
    const stakeholderLines = p.stakeholders.map((row, i) => {
      const s = lang === 'cn' ? row.subject.cn : row.subject.en;
      const r = lang === 'cn' ? row.role.cn : row.role.en;
      const im = lang === 'cn' ? row.impact.cn : row.impact.en;
      const a = lang === 'cn' ? row.anchor.cn : row.anchor.en;
      return `${i + 1}. ${s} (${r}) — ${im} / ${a}`;
    });
    blocks.push({ type: 'bullets', items: stakeholderLines });

    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '可核验清单' : 'Verification checklist',
      sectionKey: 'verification',
    });
    blocks.push({
      type: 'bullets',
      items: p.verificationChecklist.map((v, i) => {
        const t = lang === 'cn' ? v.item.cn : v.item.en;
        return `${i + 1}. ${t}`;
      }),
    });

    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '审计' : 'Audit',
      sectionKey: 'audit',
    });
    blocks.push({
      type: 'p',
      text: `model: ${p.audit.model}\npromptVersion: ${p.audit.promptVersion}\ngeneratedAt: ${p.audit.generatedAt}`,
    });
  }

  if (mode === 'full') {
    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '原文' : 'Source text',
      sectionKey: 'source',
    });
    blocks.push({ type: 'p', text: record.raw_content ?? '' });

    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '卷宗' : 'Dossier',
      sectionKey: 'dossier',
    });
    blocks.push({
      type: 'p',
      text:
        dossierText.trim() || (lang === 'cn' ? '（暂无卷宗）' : '(No dossier)'),
    });
  }

  if (terminalSlice.length > 0) {
    blocks.push({
      type: 'h2',
      text: lang === 'cn' ? '终端对话（导出快照）' : 'Terminal (export snapshot)',
      sectionKey: 'terminal',
    });
    for (const m of terminalSlice) {
      const label =
        m.role === 'user'
          ? lang === 'cn'
            ? '用户'
            : 'User'
          : lang === 'cn'
            ? '助手'
            : 'Assistant';
      blocks.push({ type: 'h3', text: label });
      blocks.push({ type: 'p', text: m.content });
    }
  }

  return blocks;
}

/**
 * 由导出块生成 Markdown（供旧版 GET brief 与外部兼容）。
 */
export function intelExportBlocksToMarkdown(blocks: IntelExportBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'doc_title':
        lines.push(`# ${b.text}`, '');
        break;
      case 'meta':
        lines.push(`- **Signal:** ${b.signalId}`);
        lines.push(`- **Generated:** ${b.generatedAt}`, '');
        break;
      case 'h2':
        lines.push(`## ${b.text}`, '');
        break;
      case 'h3':
        lines.push(`### ${b.text}`, '');
        break;
      case 'p':
        lines.push(b.text, '');
        break;
      case 'bullets':
        b.items.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
        break;
      default:
        break;
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}
