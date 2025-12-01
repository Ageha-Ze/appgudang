"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default function UIWrapper({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
