import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "교차로 차량 카운터",
  description: "12개 방향의 차량 통행량을 빠르고 간편하게 집계합니다.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
