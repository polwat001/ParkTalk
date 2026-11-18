import type { User } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-sky-500/20 text-sky-300",
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-violet-500/20 text-violet-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];

export function initials(name: string) {
  return name.trim().slice(0, 2);
}

export function UserAvatar({ user, size = "sm", className }: { user?: User | null; size?: "xs" | "sm" | "md"; className?: string }) {
  const dims = size === "xs" ? "h-6 w-6 text-[10px]" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (!user) {
    return (
      <span className={cn("inline-grid place-items-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground", dims, className)} title="ยังไม่มีผู้รับผิดชอบ">
        ?
      </span>
    );
  }
  const color = COLORS[user.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className={cn("inline-grid place-items-center rounded-full font-semibold shrink-0", dims, color, className)} title={user.name}>
      {initials(user.name)}
    </span>
  );
}
