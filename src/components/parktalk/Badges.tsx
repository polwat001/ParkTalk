import { AlertTriangle, ArrowUp, ChevronDown, Clock, Minus, AlarmClock, CheckCircle2 } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL, TIME_STATUS_LABEL } from "@/lib/parktalk/constants";
import type { Priority, TaskStatus, TimeStatus } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const PRIORITY_ICON: Record<Priority, typeof AlertTriangle> = {
  critical: AlertTriangle,
  high: ArrowUp,
  medium: Minus,
  low: ChevronDown,
};

const PRIORITY_STYLE: Record<Priority, string> = {
  critical: "bg-priority-critical text-white border-priority-critical",
  high: "bg-priority-high text-white border-priority-high",
  medium: "bg-priority-medium text-white border-priority-medium",
  low: "bg-priority-low text-white border-priority-low",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border",
        PRIORITY_STYLE[priority],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  open: "bg-slate-400/15 text-slate-200 border-slate-400/40",
  todo: "bg-sky-400/15 text-sky-200 border-sky-400/40",
  in_progress: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  review: "bg-violet-400/15 text-violet-200 border-violet-400/40",
  testing: "bg-cyan-400/15 text-cyan-200 border-cyan-400/40",
  deploy: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-400/40",
  done: "bg-emerald-400/15 text-emerald-200 border-emerald-400/40",
  standby: "bg-orange-400/15 text-orange-200 border-orange-400/40",
  documents: "bg-slate-300/10 text-slate-200 border-slate-300/30",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border", STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const TIME_STYLE: Record<TimeStatus, string> = {
  on_track: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  due_soon: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  overdue: "bg-red-500/15 text-red-300 border-red-500/40",
  none: "bg-muted text-muted-foreground border-border",
};

const TIME_ICON: Record<TimeStatus, typeof Clock> = {
  on_track: Clock,
  due_soon: AlarmClock,
  overdue: AlertTriangle,
  none: CheckCircle2,
};

export function TimeBadge({ status, label, className }: { status: TimeStatus; label?: string; className?: string }) {
  const Icon = TIME_ICON[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", TIME_STYLE[status], className)}>
      <Icon className="h-3.5 w-3.5" />
      {label ?? TIME_STATUS_LABEL[status]}
    </span>
  );
}
