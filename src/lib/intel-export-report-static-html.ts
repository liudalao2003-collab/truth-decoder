import type { IntelExportBlock } from '@/lib/intel-export-sections';
import { partitionExportBlocks } from '@/lib/intel-export-layout';
import {
  INTEL_EXPORT_THEME as T,
  exportSectionAccent,
  exportSectionUsesNarrativeMono,
} from '@/lib/intel-export-theme';

/**
 * 供服务端 PDF 使用：与 IntelExportReportDom 结构一致，但不用 react-dom/server，
 * 避免 Next App Route 依赖链禁止 renderToStaticMarkup 导致构建失败。
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 与 React 内联样式一致：部分数字属性为无单位（如 line-height、font-weight）。 */
function inlineStyle(style: Record<string, string | number | undefined>): string {
  const unitlessKeys = new Set([
    'line-height',
    'font-weight',
    'opacity',
    'z-index',
    'flex-grow',
    'flex-shrink',
    'order',
  ]);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined) continue;
    const cssKey = k.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    let cssVal: string;
    if (typeof v === 'number') {
      cssVal = unitlessKeys.has(cssKey) ? String(v) : `${v}px`;
    } else {
      cssVal = v;
    }
    parts.push(`${cssKey}:${cssVal}`);
  }
  return parts.join(';');
}

function heroBlockHtml(block: IntelExportBlock): string {
  switch (block.type) {
    case 'doc_title':
      return `<h1 style="${inlineStyle({
        fontSize: 24,
        fontWeight: 700,
        margin: '0 0 10px',
        color: T.textPrimary,
        letterSpacing: '0.04em',
      })}">${escapeHtml(block.text)}</h1>`;
    case 'meta':
      return `<p style="${inlineStyle({
        fontSize: 12,
        color: T.textSecondary,
        margin: 0,
        lineHeight: 1.55,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      })}">Signal: ${escapeHtml(block.signalId)}<br/>Generated: ${escapeHtml(
        block.generatedAt
      )}</p>`;
    default:
      return '';
  }
}

function innerBlockHtml(block: IntelExportBlock, narrative: boolean): string {
  const mono = narrative
    ? 'ui-monospace, "Cascadia Code", Consolas, monospace'
    : 'ui-sans-serif, system-ui, "Segoe UI", "Noto Sans SC", sans-serif';

  switch (block.type) {
    case 'h3':
      return `<h3 style="${inlineStyle({
        fontSize: 13,
        fontWeight: 600,
        margin: '14px 0 8px',
        color: T.textPrimary,
        fontFamily: mono,
      })}">${escapeHtml(block.text)}</h3>`;
    case 'p':
      return `<p style="${inlineStyle({
        margin: '0 0 12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        lineHeight: 1.6,
        color: narrative ? T.textSecondary : T.textPrimary,
        fontSize: narrative ? 13 : 14,
        fontFamily: mono,
        maxWidth: '100%',
      })}">${escapeHtml(block.text)}</p>`;
    case 'bullets':
      return `<ul style="${inlineStyle({
        margin: '0 0 14px',
        paddingLeft: 20,
        color: T.textPrimary,
        fontFamily: mono,
        overflowWrap: 'anywhere',
        maxWidth: '100%',
      })}">${block.items
        .map(
          (item) =>
            `<li style="${inlineStyle({
              marginBottom: 6,
              lineHeight: 1.55,
            })}">${escapeHtml(item)}</li>`
        )
        .join('')}</ul>`;
    default:
      return '';
  }
}

function sectionCardHtml(blocks: IntelExportBlock[]): string {
  if (blocks.length === 0) return '';
  const head = blocks[0];
  if (head.type !== 'h2') {
    const wrap = inlineStyle({
      backgroundColor: T.cardBg,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: T.radiusPx,
      padding: T.cardPaddingPx,
      marginBottom: T.sectionGapPx,
      maxWidth: '100%',
      boxSizing: 'border-box',
    });
    return `<div style="${wrap}">${blocks
      .map((b) => innerBlockHtml(b, false))
      .join('')}</div>`;
  }

  const accent = exportSectionAccent(head.sectionKey);
  const narrative = exportSectionUsesNarrativeMono(head.sectionKey);
  const cardBg = narrative ? T.cardBgNarrative : T.cardBg;

  const wrap = inlineStyle({
    backgroundColor: cardBg,
    border: `1px solid ${T.cardBorder}`,
    borderRadius: T.radiusPx,
    padding: T.cardPaddingPx,
    marginBottom: T.sectionGapPx,
    borderTop: `3px solid ${accent}`,
    maxWidth: '100%',
    boxSizing: 'border-box',
  });

  const h2 = `<h2 style="${inlineStyle({
    fontSize: 17,
    fontWeight: 700,
    margin: '0 0 14px',
    color: accent,
    letterSpacing: '0.02em',
    overflowWrap: 'anywhere',
  })}">${escapeHtml(head.text)}</h2>`;

  const rest = blocks
    .slice(1)
    .map((b) => innerBlockHtml(b, narrative))
    .join('');

  return `<div style="${wrap}">${h2}${rest}</div>`;
}

export function renderIntelExportReportHtmlString(
  blocks: IntelExportBlock[]
): string {
  const { hero, sections } = partitionExportBlocks(blocks);
  const parts: string[] = [];

  if (hero.length > 0) {
    const heroWrap = inlineStyle({
      backgroundColor: T.heroBg,
      borderLeft: `4px solid ${T.brand}`,
      borderRadius: T.radiusPx,
      padding: T.heroPaddingPx,
      marginBottom: T.sectionGapPx,
      border: `1px solid ${T.cardBorder}`,
      maxWidth: '100%',
      boxSizing: 'border-box',
    });
    parts.push(
      `<div style="${heroWrap}">${hero.map((b) => heroBlockHtml(b)).join('')}</div>`
    );
  }

  for (const sec of sections) {
    parts.push(sectionCardHtml(sec));
  }

  return parts.join('');
}
