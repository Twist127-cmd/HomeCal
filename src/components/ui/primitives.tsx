"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Profile } from "@/lib/types";

export function Button({
  variant = "default",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "danger" | "soft"; size?: "sm" | "md" | "lg" | "icon" }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-14 px-6 text-base",
        size === "icon" && "h-11 w-11",
        variant === "default" && "bg-surface border border-border hover:bg-surface-2",
        variant === "primary" && "bg-accent text-white hover:opacity-90 shadow-sm dark:text-black",
        variant === "ghost" && "hover:bg-surface-2",
        variant === "soft" && "bg-accent-soft text-accent hover:opacity-90",
        variant === "danger" && "bg-danger/10 text-danger hover:bg-danger/15",
        className,
      )}
    />
  );
}

export function Chip({
  active,
  color,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; color?: string }) {
  return (
    <button
      type="button"
      {...props}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={clsx(
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition active:scale-[0.97]",
        active ? (color ? "text-white" : "bg-text text-bg border-text") : "border-border bg-surface hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Avatar({ profile, size = 28, ring }: { profile?: Profile; size?: number; ring?: boolean }) {
  if (!profile) return null;
  const isEmoji = /\p{Extended_Pictographic}/u.test(profile.avatar);
  return (
    <span
      title={profile.name}
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", ring && "ring-2 ring-surface")}
      style={{ width: size, height: size, backgroundColor: profile.color, fontSize: isEmoji ? size * 0.55 : size * 0.4 }}
    >
      {profile.avatar || profile.name.charAt(0)}
    </span>
  );
}

export function AvatarStack({ profiles, ids, size = 22 }: { profiles: Profile[]; ids: string[]; size?: number }) {
  const list = ids.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);
  return (
    <span className="inline-flex -space-x-1.5">
      {list.slice(0, 4).map((p) => (
        <Avatar key={p.id} profile={p} size={size} ring />
      ))}
    </span>
  );
}

/** Bottom sheet on mobile, centered dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose(): void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          "relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-[1.75rem] bg-surface shadow-pop sm:rounded-[1.75rem]",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl",
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-2 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1 text-lg font-semibold">{title}</div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </Button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 pb-4 sm:px-6">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap items-center gap-2 border-t border-border px-5 pt-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-[15px] outline-none transition focus:border-accent focus:bg-surface";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-11 w-full items-center justify-between gap-4 py-2 text-left">
      <span className="text-[15px]">{label}</span>
      <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-surface-3")}>
        <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("glass-panel", className)}>{children}</div>;
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
      style={{ width: size, height: size }}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden="true" />;
}
