import { addDays, differenceInCalendarDays, format, isSameDay, isWeekend, startOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { EmptyState } from "./EmptyState";
import { UserAvatar } from "./UserAvatar";
import { STATUS_LABEL, labelOf } from "@/lib/parktalk/constants";
import { timeStatus } from "@/lib/parktalk/time";
import type { Database, Task } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const DAYS = 28;
const DAY_W = 36;

/** Simple timeline: one bar per card from its start (or creation) to its due date. */
export function BoardTimeline({ tasks, db, onOpen }: { tasks: Task[]; db: Database; onOpen: (id: string) => void }) {
  const today = startOfDay(new Date());
  const start = addDays(today, -7);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const rows = tasks
    .filter((t) => t.status !== "documents")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (rows.length === 0) return <EmptyState className="bg-black/20 border-white/15 text-white/70">ไม่มีการ์ดที่ตรงกับฟิลเตอร์</EmptyState>;

  return (
    <div className="rounded-xl border border-white/10 bg-[hsl(222_56%_9%/0.92)] overflow-hidden w-max min-w-full">
      <div className="flex border-b border-white/10 sticky top-0 bg-[hsl(222_56%_9%)] z-10">
        <div className="w-72 shrink-0 px-3 py-2 text-xs font-semibold text-white/60">การ์ด</div>
        {days.map((d) => (
          <div
            key={d.toISOString()}
            style={{ width: DAY_W }}
            className={cn("shrink-0 py-1 text-center text-[11px] leading-tight", isWeekend(d) && "bg-white/5", isSameDay(d, today) ? "text-secondary font-bold" : "text-white/55")}
          >
            <div>{format(d, "EEEEE", { locale: th })}</div>
            <div>{format(d, "d")}</div>
          </div>
        ))}
      </div>
      {rows.map((t) => {
        const from = startOfDay(new Date(t.startDate ?? t.createdAt));
        const to = startOfDay(new Date(t.dueDate));
        const a = Math.max(0, differenceInCalendarDays(from, start));
        const b = Math.min(DAYS - 1, differenceInCalendarDays(to, start));
        const visible = b >= 0 && a <= DAYS - 1 && a <= b;
        const ts = timeStatus(t, db.settings);
        const bar = labelOf(t.labels[0] ?? "")?.bar ?? "bg-primary";
        return (
          <button key={t.id} onClick={() => onOpen(t.id)} className="flex w-full items-center border-b border-white/5 hover:bg-white/5 text-left">
            <div className="w-72 shrink-0 px-3 py-2 flex items-center gap-2 min-w-0">
              <UserAvatar user={db.users.find((u) => u.id === t.assigneeId)} size="xs" />
              <span className="min-w-0">
                <span className="block text-sm truncate">{t.title}</span>
                <span className="block text-[11px] text-white/50">{t.id} · {STATUS_LABEL[t.status]}</span>
              </span>
            </div>
            <div className="relative h-10" style={{ width: DAYS * DAY_W }}>
              <div className="absolute inset-y-0 w-px bg-secondary/60" style={{ left: differenceInCalendarDays(today, start) * DAY_W + DAY_W / 2 }} />
              {visible && (
                <div
                  className={cn(
                    "absolute top-2.5 h-5 rounded-md opacity-90",
                    t.status === "done" ? "bg-emerald-500/60" : bar,
                    ts === "overdue" && "ring-2 ring-red-500",
                  )}
                  style={{ left: a * DAY_W + 3, width: (b - a + 1) * DAY_W - 6 }}
                  title={`${format(from, "d MMM", { locale: th })} – ${format(to, "d MMM", { locale: th })}`}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
