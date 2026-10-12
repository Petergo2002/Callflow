import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";
import { CloudAccess } from "@/components/cloud-access";
import "./globals.css";
export const metadata: Metadata = {
  title: "CALLFLOW — Mer momentum. Mindre administration.",
  description:
    "Ditt fokuserade arbetsrum för fler samtal, bättre uppföljning och nästa affär.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <CloudAccess>{children}</CloudAccess>
        </StoreProvider>
      </body>
    </html>
  );
}
