import type { Metadata } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});
const gowunBatang = Gowun_Batang({ variable: "--font-display", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "교차로 차량 조사 대시보드",
  description: "로그인 후 영상 전처리와 차량 카운팅을 한 곳에서 관리합니다.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKr.variable} ${gowunBatang.variable}`}>{children}</body>
    </html>
  );
}
