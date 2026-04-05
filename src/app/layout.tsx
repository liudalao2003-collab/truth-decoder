import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truth Decoder - 商业情报解码",
  description: "去伪存真引擎",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="[color-scheme:light]">
      <body className="antialiased min-h-screen bg-[var(--td-surface-0)] text-[var(--td-text-primary)] selection:bg-red-100 selection:text-red-900">
        {children}
      </body>
    </html>
  );
}