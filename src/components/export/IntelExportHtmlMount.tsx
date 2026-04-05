'use client';

import { forwardRef } from 'react';
import type { IntelExportBlock } from '@/lib/intel-export-sections';
import { INTEL_EXPORT_THEME as T } from '@/lib/intel-export-theme';
import { IntelExportReportDom } from '@/components/export/IntelExportReportDom';

/**
 * 离屏挂载供 html2canvas 截取全长图；固定版心宽度接近 A4 逻辑像素。
 * 注意：单张 canvas 高度受浏览器上限制约，超高时解码页应降级提示改用 PDF。
 */
export const IntelExportHtmlMount = forwardRef<
  HTMLDivElement,
  { blocks: IntelExportBlock[] }
>(function IntelExportHtmlMount({ blocks }, ref) {
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: -12000,
        top: 0,
        width: 794,
        minHeight: 80,
        padding: 28,
        backgroundColor: T.pageBg,
        fontFamily:
          'ui-sans-serif, system-ui, "Segoe UI", "Noto Sans SC", sans-serif',
        fontSize: 14,
        color: T.textPrimary,
        boxSizing: 'border-box',
      }}
    >
      <IntelExportReportDom blocks={blocks} />
    </div>
  );
});
