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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased bg-black text-white">
        {children}
      </body>
    </html>
  );
}