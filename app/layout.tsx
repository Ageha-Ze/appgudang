// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConnectionHandler from "@/components/ConnectionHandler";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GUDANG KITA - Sistem Inventori & Manajemen Keuangan",
  description: "Sistem manajemen inventori dan penjualan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        <ConnectionHandler />
      </body>
    </html>
  );
}
