import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { TopNav } from "../components/TopNav";

export function DashboardLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar isOpen={isNavigationOpen} onClose={() => setIsNavigationOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav onMenuClick={() => setIsNavigationOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
