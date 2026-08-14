import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "予定 — Googleカレンダー連携スケジュール",
  description:
    "Googleカレンダーと生活習慣、タスク分割から、無理のないスケジュールを自動生成するアプリ。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
