import { cn } from "@/lib/utils";

export function ParkTalkLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn("h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center text-white font-black text-lg shadow-glow", className)}
      aria-hidden
    >
      P
    </span>
  );
}
