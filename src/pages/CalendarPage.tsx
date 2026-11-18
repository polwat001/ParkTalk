import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { th } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { PriorityBadge, StatusBadge, TimeBadge } from "@/components/parktalk/Badges";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { TaskFormDialog } from "@/components/parktalk/TaskFormDialog";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { can, visibleProjects } from "@/lib/parktalk/permissions";
import { useCurrentUser, useDb } from "@/lib/parktalk/store";
import { relativeDue, timeStatus } from "@/lib/parktalk/time";
import type { Task, TaskStatus } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day";
const ALL = "all";

const CHIP: Record<TaskStatus, string> = {
  open: "bg-slate-400/15 text-slate-200 border-slate-400/40",
  todo: "bg-sky-400/15 text-sky-200 border-sky-400/40",
  in_progress: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  review: "bg-violet-400/15 text-violet-200 border-violet-400/40",
  testing: "bg-cyan-400/15 text-cyan-200 border-cyan-400/40",
  deploy: "bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-400/40",
  done: "bg-emerald-400/15 text-emerald-200 border-emerald-400/40 line-through opacity-70",
  standby: "bg-orange-400/15 text-orange-200 border-orange-400/40",
  documents: "bg-slate-300/10 text-slate-200 border-slate-300/30",
};

const WEEK_OPTS = { weekStartsOn: 1 as const };

export default function CalendarPage() {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [params] = useSearchParams();
  const [projectId, setProjectId] = useState(() => params.get("project") ?? ALL);
  const [memberId, setMemberId] = useState(() => params.get("member") ?? ALL);
  const [createFor, setCreateFor] = useState<Date | null>(null);

  const projects = useMemo(() => visibleProjects(db, me), [db, me]);
  const canCreate = projects.some((p) => can(db, me, "createTask", p));
  const memberIds = useMemo(() => {
    const ps = projectId === ALL ? projects : projects.filter((p) => p.id === projectId);
    return [...new Set(ps.flatMap((p) => p.members.map((m) => m.userId)))];
  }, [projects, projectId]);

  const tasks = useMemo(
    () =>
      db.tasks
        .filter((t) => t.status !== "documents" && projects.some((p) => p.id === t.projectId))
        .filter((t) => projectId === ALL || t.projectId === projectId)
        .filter((t) => memberId === ALL || (memberId === "mine" ? t.assigneeId === me?.id || t.collaboratorIds.includes(me?.id ?? "") : t.assigneeId === memberId)),
    [db, projects, projectId, memberId, me],
  );

  const byDay = (d: Date) => tasks.filter((t) => isSameDay(new Date(t.dueDate), d)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (!me) return null;

  const range =
    view === "month"
      ? { start: startOfWeek(startOfMonth(cursor), WEEK_OPTS), end: endOfWeek(endOfMonth(cursor), WEEK_OPTS) }
      : view === "week"
        ? { start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) }
        : { start: cursor, end: cursor };
  const days: Date[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d);

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));

  const heading =
    view === "month"
      ? format(cursor, "LLLL yyyy", { locale: th })
      : view === "week"
        ? `${format(range.start, "d MMM", { locale: th })} – ${format(range.end, "d MMM yyyy", { locale: th })}`
        : format(cursor, "EEEE d MMMM yyyy", { locale: th });

  const overdueInRange = tasks.filter((t) => timeStatus(t, db.settings) === "overdue").length;

  const chip = (t: Task, compact: boolean) => {
    const ts = timeStatus(t, db.settings);
    const user = db.users.find((u) => u.id === t.assigneeId);
    return (
      <button
        key={t.id}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/tasks/${t.id}`);
        }}
        title={`${t.id} ${t.title} — ${user?.name ?? "ยังไม่มอบหมาย"} — ${format(new Date(t.dueDate), "HH:mm")}`}
        className={cn(
          "w-full text-left rounded border px-1.5 py-1 text-xs flex items-center gap-1 hover:shadow-card transition-shadow",
          CHIP[t.status],
          ts === "overdue" && "border-red-500 border-l-4",
        )}
      >
        <UserAvatar user={user} size="xs" className="h-5 w-5 text-[9px]" />
        <span className="truncate flex-1">{compact ? t.title : `${t.id} · ${t.title}`}</span>
        {!compact && <span className="shrink-0 opacity-70">{format(new Date(t.dueDate), "HH:mm")}</span>}
      </button>
    );
  };

  return (
    <AppLayout
      wide
      title="ปฏิทินงาน"
      subtitle={`งานที่ครบกำหนดในช่วงที่แสดง · เลยกำหนดทั้งหมด ${overdueInRange} งาน — คลิกวันที่เพื่อสร้างงาน คลิกงานเพื่อดูรายละเอียด`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => step(-1)} aria-label="ก่อนหน้า"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>วันนี้</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => step(1)} aria-label="ถัดไป"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <h2 className="text-xl font-semibold min-w-48">{heading}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={projectId} onValueChange={(v) => { setProjectId(v); setMemberId(ALL); }}>
            <SelectTrigger className="h-9 w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกโครงการ</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="h-9 w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกคน</SelectItem>
              <SelectItem value="mine">งานของฉัน</SelectItem>
              {memberIds.map((id) => <SelectItem key={id} value={id}>{db.users.find((u) => u.id === id)?.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-md border bg-card p-1 h-9" role="tablist" aria-label="มุมมอง">
            {(["month", "week", "day"] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn("px-3 text-sm rounded font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                {v === "month" ? "เดือน" : v === "week" ? "สัปดาห์" : "วัน"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "day" ? (
        <Card className="p-4 space-y-3 shadow-card">
          {byDay(cursor).length === 0 ? (
            <EmptyState>ไม่มีงานครบกำหนดในวันนี้</EmptyState>
          ) : (
            byDay(cursor).map((t) => {
              const user = db.users.find((u) => u.id === t.assigneeId);
              const ts = timeStatus(t, db.settings);
              return (
                <button key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} className="w-full text-left rounded-lg border p-3 flex flex-wrap items-center gap-3 hover:bg-muted/40">
                  <span className="font-mono text-xs text-muted-foreground w-16">{format(new Date(t.dueDate), "HH:mm")}</span>
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{t.id} · {t.title}</div>
                    <div className="text-xs text-muted-foreground">{user?.name ?? "ยังไม่มอบหมาย"} · {db.projects.find((p) => p.id === t.projectId)?.name}</div>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status={t.status} />
                  <TimeBadge status={ts} label={ts === "none" ? "ปิดแล้ว" : relativeDue(t.dueDate)} />
                </button>
              );
            })
          )}
          {canCreate && (
            <Button variant="outline" size="sm" onClick={() => setCreateFor(cursor)}><Plus className="h-4 w-4" /> สร้างงานวันนี้</Button>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[48rem] rounded-xl border bg-card shadow-card overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {days.slice(0, 7).map((d) => (
                <div key={d.toISOString()} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center">
                  {format(d, "EEE", { locale: th })}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const items = byDay(d);
                const today = isSameDay(d, new Date());
                const max = view === "month" ? 3 : 20;
                return (
                  <div
                    key={d.toISOString()}
                    onClick={() => (canCreate ? setCreateFor(d) : undefined)}
                    className={cn(
                      "border-r border-b p-1.5 space-y-1 group",
                      view === "month" ? "min-h-[7.5rem]" : "min-h-[22rem]",
                      view === "month" && !isSameMonth(d, cursor) && "bg-muted/30 text-muted-foreground",
                      canCreate && "cursor-pointer hover:bg-secondary/5",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={(e) => { e.stopPropagation(); setCursor(d); setView("day"); }}
                        className={cn("h-6 min-w-6 px-1 rounded-full text-xs font-semibold grid place-items-center hover:bg-muted", today && "bg-secondary text-secondary-foreground hover:bg-secondary")}
                        aria-label={`ดูงานวันที่ ${format(d, "d MMMM", { locale: th })}`}
                      >
                        {format(d, "d")}
                      </button>
                      {canCreate && <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                    </div>
                    {items.slice(0, max).map((t) => chip(t, view === "month"))}
                    {items.length > max && (
                      <button className="text-xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setCursor(d); setView("day"); }}>
                        +{items.length - max} งาน
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(Object.keys(CHIP) as TaskStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1"><span className={cn("h-3 w-3 rounded border", CHIP[s])} /><StatusLabel s={s} /></span>
        ))}
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-l-4 border-red-500 border" />เลยกำหนด</span>
      </div>

      <TaskFormDialog
        open={!!createFor}
        onOpenChange={(o) => !o && setCreateFor(null)}
        projectId={projectId === ALL ? undefined : projectId}
        dueDate={createFor ?? undefined}
      />
    </AppLayout>
  );
}

function StatusLabel({ s }: { s: TaskStatus }) {
  return <StatusBadge status={s} className="border-0 bg-transparent p-0 font-normal text-muted-foreground" />;
}
