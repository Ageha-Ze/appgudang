import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import UIWrapper from "@/components/UIWrapper";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GUDANG KITA - Sistem Inventori",
  description: "Sistem manajemen inventori dan penjualan",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <UIWrapper>{children}</UIWrapper>
      </body>
    </html>
  );
}
