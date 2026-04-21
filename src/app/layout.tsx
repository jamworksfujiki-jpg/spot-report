import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "スポット社労士くん 統合レポート",
  description: "Google広告・GA4・Instagram の統合ダッシュボード",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-[#F5F5F7] text-[#1D1D1F] min-h-screen">
        {children}
      </body>
    </html>
  );
}
