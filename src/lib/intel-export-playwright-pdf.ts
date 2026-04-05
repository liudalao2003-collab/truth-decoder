import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import type { IntelExportBlock } from '@/lib/intel-export-sections';
import { INTEL_EXPORT_THEME as T } from '@/lib/intel-export-theme';
import { renderIntelExportReportHtmlString } from '@/lib/intel-export-report-static-html';

const EXPORT_WIDTH_PX = 794;
const EXPORT_PADDING_PX = 28;

/**
 * 与 IntelExportHtmlMount 外层壳一致的根节点样式（Playwright 与长图同宽同内边距）。
 */
function buildExportHtmlDocument(innerMarkup: string): string {
  const rootStyle = [
    `width:${EXPORT_WIDTH_PX}px`,
    `min-height:80px`,
    `padding:${EXPORT_PADDING_PX}px`,
    `background-color:${T.pageBg}`,
    `box-sizing:border-box`,
    `margin:0`,
    `font-family:ui-sans-serif,system-ui,"Segoe UI","Noto Sans SC",sans-serif`,
    `font-size:14px`,
    `color:${T.textPrimary}`,
  ].join(';');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
html,body{margin:0;padding:0;background:${T.pageBg};}
</style>
</head>
<body>
<div id="intel-export-root" style="${rootStyle}">${innerMarkup}</div>
</body>
</html>`;
}

/**
 * 本机已安装的 Chrome / Edge / Chromium 可执行文件（playwright-core 未自带浏览器时的回退）。
 */
function systemChromiumExecutableCandidates(): string[] {
  const plat = process.platform;
  const raw: string[] = [];

  if (plat === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (local) {
      raw.push(join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
    raw.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    );
  } else if (plat === 'darwin') {
    raw.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    raw.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of raw) {
    if (!p || seen.has(p) || !existsSync(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/**
 * Vercel / AWS Lambda 等无图形 Linux：使用 @sparticuz/chromium 自带的 headless 二进制。
 */
async function launchChromiumServerless(): Promise<Browser> {
  const { default: ServerlessChromium } = await import('@sparticuz/chromium');
  const executablePath = await ServerlessChromium.executablePath();
  return chromium.launch({
    headless: true,
    args: ServerlessChromium.args,
    executablePath,
  });
}

/**
 * 启动无头 Chromium：
 * CHROMIUM_EXECUTABLE_PATH → Vercel（@sparticuz/chromium）→ Playwright 缓存 → 本机 Chrome/Edge。
 */
async function launchChromium(): Promise<Browser> {
  const exec = process.env.CHROMIUM_EXECUTABLE_PATH?.trim();
  const baseArgs = ['--no-sandbox', '--disable-setuid-sandbox'];

  if (exec) {
    return chromium.launch({
      headless: true,
      executablePath: exec,
      args: baseArgs,
    });
  }

  if (process.env.VERCEL === '1') {
    return launchChromiumServerless();
  }

  try {
    return await chromium.launch({ headless: true, args: baseArgs });
  } catch {
    /* Playwright 未下载浏览器时继续探测系统安装 */
  }

  const candidates = systemChromiumExecutableCandidates();
  let lastErr = '无可用系统浏览器路径';
  for (const p of candidates) {
    try {
      return await chromium.launch({
        headless: true,
        executablePath: p,
        args: baseArgs,
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(
    `Chromium 未就绪（${lastErr}）。请执行 npx playwright install chromium，或安装 Chrome/Edge，或设置 CHROMIUM_EXECUTABLE_PATH。`
  );
}

/**
 * 使用与长图相同的 HTML 结构，经 Chromium 打印为单页等高 PDF（零边距、保留背景色）。
 * 需本机 Chrome/Edge 或设置 CHROMIUM_EXECUTABLE_PATH，或已安装 Playwright 自带 Chromium。
 */
export async function renderIntelExportPdfBuffer(
  blocks: IntelExportBlock[]
): Promise<Uint8Array> {
  const inner = renderIntelExportReportHtmlString(blocks);
  const html = buildExportHtmlDocument(inner);

  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({
      width: EXPORT_WIDTH_PX,
      height: 800,
    });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const contentHeight = await page.evaluate(() => {
      const el = document.getElementById('intel-export-root');
      if (!el) return document.documentElement.scrollHeight;
      return Math.max(el.scrollHeight, el.getBoundingClientRect().height);
    });

    const h = Math.max(120, Math.ceil(contentHeight));

    const pdfBuf = await page.pdf({
      width: `${EXPORT_WIDTH_PX}px`,
      height: `${h}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return new Uint8Array(pdfBuf);
  } finally {
    await browser.close();
  }
}
