import { cn } from "@/lib/utils";

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}
