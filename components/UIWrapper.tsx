"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { usePathname } from "next/navigation";

export default function UIWrapper({ children }: { children: React.ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const pathname = usePathname();

  const isAuthPage = pathname === "/login";
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        isExpanded={sidebarExpanded}
        setIsExpanded={setSidebarExpanded}
      />

      {/* Konten tetap dengan margin kiri 80px (w-20 = 5rem = 80px) */}
      <div className="ml-20 min-h-screen">
        <main className="p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}