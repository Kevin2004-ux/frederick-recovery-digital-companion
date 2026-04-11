import { BookOpen, House, Package, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";

const items = [
  { label: "Home", path: routes.patientHome, icon: House },
  { label: "Tracker", path: routes.patientTracker, icon: Package },
  { label: "Hub", path: routes.patientMedicalHub, icon: BookOpen },
  { label: "Profile", path: routes.patientProfile, icon: UserRound },
];

export function PatientBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-transparent px-3 pb-3 pt-2">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-2 rounded-[28px] border border-white/80 bg-white/92 px-3 py-3 shadow-[0_18px_44px_rgba(25,63,74,0.16)] backdrop-blur">
        {items.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || location.pathname.startsWith(`${path}/`);

          return (
            <Link
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_rgba(30,111,134,0.08)]"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
              )}
              key={path}
              to={path}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
