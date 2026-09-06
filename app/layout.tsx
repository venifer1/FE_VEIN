import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "VEIN — 트레이딩 인텔리전스",
  description: "VEIN 내부 알파 — 코인 패턴 신호 클라이언트",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f1521",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
