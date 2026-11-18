import { cn } from "@/lib/utils";

/** WEBPARK "W" mark (transparent PNG). */
export function ParkTalkLogo({ className }: { className?: string }) {
  return <img src="/brand/webpark-mark.png" alt="" aria-hidden className={cn("h-8 w-8 object-contain shrink-0", className)} draggable={false} />;
}

/**
 * Full WEBPARK logo. `onDark` uses the version with a white wordmark,
 * for the dark navy header and login panel.
 */
export function WebparkLogo({ onDark = true, className }: { onDark?: boolean; className?: string }) {
  return (
    <img
      src={onDark ? "/brand/webpark-logo-dark.png" : "/brand/webpark-logo.png"}
      alt="WEBPARK"
      className={cn("h-8 w-auto object-contain shrink-0", className)}
      draggable={false}
    />
  );
}
