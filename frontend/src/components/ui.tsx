import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-lg border border-ink-700 bg-ink-900", className)}>{children}</div>
  );
}

export function CardHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-[#a7adbb]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({
  children, onClick, variant = "primary", disabled, small, type,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "outline";
  disabled?: boolean; small?: boolean; type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-[#e8a13c] text-black hover:bg-[#f2b45c] disabled:opacity-50 font-semibold",
    ghost: "text-[#a7adbb] hover:text-white hover:bg-ink-800 disabled:opacity-50",
    danger: "bg-[#5a2323] text-[#f0a0a0] hover:bg-[#6e2b2b] disabled:opacity-50",
    outline: "border border-ink-600 text-[#e8e9ec] hover:border-[#e8a13c] disabled:opacity-50",
  } as const;
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={clsx("rounded-md transition-colors", small ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm", styles[variant])}
    >
      {children}
    </button>
  );
}

const badgeColors: Record<string, string> = {
  allow: "bg-[#123526] text-[#4cc38a]",
  deny: "bg-[#3d1d1d] text-[#e05d5d]",
  approval: "bg-[#3a2c12] text-[#e8a13c]",
  attack_succeeded: "bg-[#3d1d1d] text-[#ff8a8a]",
  attack_blocked: "bg-[#123526] text-[#4cc38a]",
  benign_pass: "bg-[#123526] text-[#4cc38a]",
  benign_issue: "bg-[#3a2c12] text-[#e8a13c]",
  inconclusive: "bg-ink-700 text-[#a7adbb]",
  protected: "bg-[#123526] text-[#4cc38a]",
  unprotected: "bg-[#3a2c12] text-[#e8a13c]",
  mock: "bg-ink-700 text-[#5aa9e6]",
  meta: "bg-[#1d2c3d] text-[#5aa9e6]",
  yes: "bg-[#3d1d1d] text-[#ff8a8a]",
  no: "bg-[#123526] text-[#4cc38a]",
  unknown: "bg-ink-700 text-[#a7adbb]",
  pending: "bg-[#3a2c12] text-[#e8a13c]",
  approved: "bg-[#123526] text-[#4cc38a]",
  rejected: "bg-ink-700 text-[#a7adbb]",
  completed: "bg-[#123526] text-[#4cc38a]",
  error: "bg-[#3d1d1d] text-[#ff8a8a]",
  timeout: "bg-[#3a2c12] text-[#e8a13c]",
  running: "bg-[#1d2c3d] text-[#5aa9e6]",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={clsx("inline-block rounded px-2 py-0.5 font-mono text-[11px] font-medium", badgeColors[value] || "bg-ink-700 text-[#a7adbb]")}>
      {label || value}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 px-5 py-4">
      <div className="text-[12px] font-medium uppercase tracking-wide text-[#a7adbb]">{label}</div>
      <div className="mt-1 font-mono text-[26px] font-semibold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-[#a7adbb]">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-600 bg-ink-900 px-6 py-10 text-center">
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-[#a7adbb]">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium uppercase tracking-wide text-[#a7adbb]">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-[#5b6172] focus:border-[#e8a13c] focus:outline-none";

export function PageHead({ title, sub, right }: { title: string; sub: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-[#a7adbb]">{sub}</p>
      </div>
      {right && <div className="flex gap-2">{right}</div>}
    </div>
  );
}
