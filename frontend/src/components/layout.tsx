import { NavLink, Outlet } from "react-router-dom";
import {
  Activity, Bot, FlaskConical, ScrollText, ShieldCheck, FileBarChart, Search, Settings as SettingsIcon,
} from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { to: "/", label: "Overview", icon: Activity, end: true },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/lab", label: "Attack Lab", icon: FlaskConical },
  { to: "/policies", label: "Security Policies", icon: ShieldCheck },
  { to: "/runs", label: "Test Runs", icon: ScrollText },
  { to: "/evidence", label: "Evidence Explorer", icon: Search },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect x="1.5" y="1.5" width="23" height="23" rx="5" fill="none" stroke="#e8a13c" strokeWidth="2" />
        <line x1="6" y1="19" x2="12.5" y2="7" stroke="#e8a13c" strokeWidth="2.4" />
        <line x1="13.5" y1="19" x2="20" y2="7" stroke="#e05d5d" strokeWidth="2.4" />
      </svg>
      <div className="leading-none">
        <div className="text-[15px] font-bold tracking-tight text-white">
          BREACH<span className="text-[#e8a13c]">//</span>POINT
        </div>
        <div className="mt-1 text-[10.5px] text-[#a7adbb]">Agent Security Verification</div>
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-[#0c0d10]">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-ink-700 bg-[#121318]">
        <Logo />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-ink-800 font-medium text-white" : "text-[#a7adbb] hover:bg-ink-800 hover:text-white"
                )
              }
            >
              <n.icon size={17} strokeWidth={2} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-700 px-5 py-4 text-[11.5px] leading-relaxed text-[#a7adbb]">
          Policies control actions.
          <br />
          Evidence determines outcomes.
        </div>
      </aside>
      <main className="ml-60 flex-1 px-8 py-7">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
