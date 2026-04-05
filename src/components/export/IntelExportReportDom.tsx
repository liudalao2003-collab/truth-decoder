import type { IntelExportBlock } from '@/lib/intel-export-sections';
import { partitionExportBlocks } from '@/lib/intel-export-layout';
import {
  INTEL_EXPORT_THEME as T,
  exportSectionAccent,
  exportSectionUsesNarrativeMono,
} from '@/lib/intel-export-theme';

function HeroBlockHtml({ block }: { block: IntelExportBlock }) {
  switch (block.type) {
    case 'doc_title':
      return (
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: '0 0 10px',
            color: T.textPrimary,
            letterSpacing: '0.04em',
          }}
        >
          {block.text}
        </h1>
      );
    case 'meta':
      return (
        <p
          style={{
            fontSize: 12,
            color: T.textSecondary,
            margin: 0,
            lineHeight: 1.55,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          Signal: {block.signalId}
          <br />
          Generated: {block.generatedAt}
        </p>
      );
    default:
      return null;
  }
}

function InnerBlockHtml({
  block,
  narrative,
}: {
  block: IntelExportBlock;
  narrative: boolean;
}) {
  const mono = narrative
    ? 'ui-monospace, "Cascadia Code", Consolas, monospace'
    : 'ui-sans-serif, system-ui, "Segoe UI", "Noto Sans SC", sans-serif';

  switch (block.type) {
    case 'h3':
      return (
        <h3
          style={{
            fontSize: 13,
            fontWeight: 600,
            margin: '14px 0 8px',
            color: T.textPrimary,
            fontFamily: mono,
          }}
        >
          {block.text}
        </h3>
      );
    case 'p':
      return (
        <p
          style={{
            margin: '0 0 12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            lineHeight: 1.6,
            color: narrative ? T.textSecondary : T.textPrimary,
            fontSize: narrative ? 13 : 14,
            fontFamily: mono,
            maxWidth: '100%',
          }}
        >
          {block.text}
        </p>
      );
    case 'bullets':
      return (
        <ul
          style={{
            margin: '0 0 14px',
            paddingLeft: 20,
            color: T.textPrimary,
            fontFamily: mono,
            overflowWrap: 'anywhere',
            maxWidth: '100%',
          }}
        >
          {block.items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 6, lineHeight: 1.55 }}>
              {item}
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

function SectionCardHtml({ blocks }: { blocks: IntelExportBlock[] }) {
  if (blocks.length === 0) return null;
  const head = blocks[0];
  if (head.type !== 'h2') {
    return (
      <div
        style={{
          backgroundColor: T.cardBg,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: T.radiusPx,
          padding: T.cardPaddingPx,
          marginBottom: T.sectionGapPx,
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {blocks.map((b, i) => (
          <InnerBlockHtml key={i} block={b} narrative={false} />
        ))}
      </div>
    );
  }

  const accent = exportSectionAccent(head.sectionKey);
  const narrative = exportSectionUsesNarrativeMono(head.sectionKey);
  const cardBg = narrative ? T.cardBgNarrative : T.cardBg;

  return (
    <div
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${T.cardBorder}`,
        borderRadius: T.radiusPx,
        padding: T.cardPaddingPx,
        marginBottom: T.sectionGapPx,
        borderTop: `3px solid ${accent}`,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <h2
        style={{
          fontSize: 17,
          fontWeight: 700,
          margin: '0 0 14px',
          color: accent,
          letterSpacing: '0.02em',
          overflowWrap: 'anywhere',
        }}
      >
        {head.text}
      </h2>
      {blocks.slice(1).map((b, i) => (
        <InnerBlockHtml key={i} block={b} narrative={narrative} />
      ))}
    </div>
  );
}

/**
 * 与长图 / Playwright PDF 共用的报告 DOM（无 client、无离屏定位）。
 * PDF 服务端走 @/lib/intel-export-report-static-html（禁止 react-dom/server），修改版式时请同步两处。
 */
export function IntelExportReportDom({
  blocks,
}: {
  blocks: IntelExportBlock[];
}) {
  const { hero, sections } = partitionExportBlocks(blocks);

  return (
    <>
      {hero.length > 0 ? (
        <div
          style={{
            backgroundColor: T.heroBg,
            borderLeft: `4px solid ${T.brand}`,
            borderRadius: T.radiusPx,
            padding: T.heroPaddingPx,
            marginBottom: T.sectionGapPx,
            border: `1px solid ${T.cardBorder}`,
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {hero.map((b, i) => (
            <HeroBlockHtml key={i} block={b} />
          ))}
        </div>
      ) : null}

      {sections.map((sec, i) => (
        <SectionCardHtml key={i} blocks={sec} />
      ))}
    </>
  );
}
