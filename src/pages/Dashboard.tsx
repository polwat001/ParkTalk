import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Eye, Loader2, Timer, RotateCcw, Target } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { PriorityBadge, TimeBadge } from "@/components/parktalk/Badges";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABEL } from "@/lib/parktalk/constants";
import { downloadCsv } from "@/lib/parktalk/csv";
import { can, visibleProjects } from "@/lib/parktalk/permissions";
import { useCurrentUser, useDb } from "@/lib/parktalk/store";
import { HOUR, fmtDateTime, relativeDue, timeStatus } from "@/lib/parktalk/time";
import type { Task } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const RANGES = { "7": "7 วันล่าสุด", "30": "30 วันล่าสุด", "90": "90 วันล่าสุด", all: "ทั้งหมด" } as const;

export default function Dashboard() {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [range, setRange] = useState<keyof typeof RANGES>("30");
  const [params] = useSearchParams();
  const [projectId, setProjectId] = useState(() => params.get("project") ?? "all");

  const projects = useMemo(() => visibleProjects(db, me), [db, me]);
  const tasks = useMemo(
    () => db.tasks.filter((t) => projects.some((p) => p.id === t.projectId) && (projectId === "all" || t.projectId === projectId)),
    [db, projects, projectId],
  );

  const stats = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 24 * HOUR;
    const open = tasks.filter((t) => t.status !== "done");
    const closed = tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt).getTime() >= since);
    const onTime = closed.filter((t) => new Date(t.completedAt!).getTime() <= new Date(t.dueDate).getTime()).length;
    const cycle = closed.map((t) => new Date(t.completedAt!).getTime() - new Date(t.startDate ?? t.createdAt).getTime());
    return {
      total: tasks.length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      inReview: tasks.filter((t) => t.status === "review").length,
      done: tasks.filter((t) => t.status === "done").length,
      overdue: open.filter((t) => timeStatus(t, db.settings) === "overdue"),
      dueSoon: open.filter((t) => timeStatus(t, db.settings) === "due_soon"),
      closedInRange: closed.length,
      onTimeRate: closed.length ? Math.round((onTime / closed.length) * 100) : null,
      avgCloseHours: cycle.length ? Math.round(cycle.reduce((a, b) => a + b, 0) / cycle.length / HOUR) : null,
      revisions: tasks.reduce((a, t) => a + t.revisionCount, 0),
      reworked: tasks.filter((t) => t.revisionCount > 0),
    };
  }, [tasks, range, db.settings]);

  if (!me) return null;

  const exportCsv = () =>
    downloadCsv(
      `parktalk-tasks-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Task ID", "Project", "Board", "Title", "Status", "Priority", "Assignee", "Due Date", "Time Status", "Completed At", "Revisions"],
      tasks.map((t) => {
        const p = db.projects.find((x) => x.id === t.projectId);
        return [
          t.id,
          p?.name ?? "",
          p?.boards.find((b) => b.id === t.boardId)?.name ?? "",
          t.title,
          STATUS_LABEL[t.status],
          t.priority,
          db.users.find((u) => u.id === t.assigneeId)?.name ?? "",
          fmtDateTime(t.dueDate),
          timeStatus(t, db.settings),
          fmtDateTime(t.completedAt),
          String(t.revisionCount),
        ];
      }),
    );

  const tiles = [
    { label: "งานทั้งหมด", value: stats.total, icon: ClipboardList, tone: "text-primary" },
    { label: "กำลังทำ", value: stats.inProgress, icon: Loader2, tone: "text-amber-400" },
    { label: "รอตรวจ", value: stats.inReview, icon: Eye, tone: "text-violet-400" },
    { label: "เสร็จสิ้น", value: stats.done, icon: CheckCircle2, tone: "text-emerald-400" },
    { label: "เลยกำหนด", value: stats.overdue.length, icon: AlertTriangle, tone: "text-red-400" },
  ];

  const list = (items: Task[], empty: string) =>
    items.length === 0 ? (
      <EmptyState className="p-4">{empty}</EmptyState>
    ) : (
      <ul className="divide-y">
        {[...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8).map((t) => {
          const u = db.users.find((x) => x.id === t.assigneeId);
          return (
            <li key={t.id}>
              <button onClick={() => navigate(`/tasks/${t.id}`)} className="w-full flex items-center gap-3 py-2 text-left hover:bg-muted/40 rounded px-1">
                <UserAvatar user={u} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{t.id} · {t.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">{u?.name ?? "ยังไม่มอบหมาย"} · {STATUS_LABEL[t.status]}</span>
                </span>
                <PriorityBadge priority={t.priority} className="hidden sm:inline-flex" />
                <TimeBadge status={timeStatus(t, db.settings)} label={relativeDue(t.dueDate)} className="shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <AppLayout
      title={`สวัสดี ${me.name}`}
      subtitle="ภาพรวมงานในโครงการที่คุณเข้าถึงได้"
      actions={
        <>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-9 w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกโครงการ</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
            <SelectTrigger className="h-9 w-36 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(RANGES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          {can(db, me, "assignTask") && (
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4 shadow-card">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              {t.label}
              <t.icon className={cn("h-4 w-4", t.tone)} />
            </div>
            <div className={cn("text-3xl font-bold mt-1", t.tone)}>{t.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4 shadow-card space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-emerald-400" /> ส่งงานตรงเวลา</div>
          <div className="text-3xl font-bold">{stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`}</div>
          <Progress value={stats.onTimeRate ?? 0} className="h-2" />
          <p className="text-xs text-muted-foreground">จากงานที่ปิด {stats.closedInRange} งาน ({RANGES[range]})</p>
        </Card>
        <Card className="p-4 shadow-card space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><Timer className="h-4 w-4 text-sky-400" /> เวลาปิดงานเฉลี่ย</div>
          <div className="text-3xl font-bold">{stats.avgCloseHours === null ? "—" : stats.avgCloseHours >= 48 ? `${Math.round(stats.avgCloseHours / 24)} วัน` : `${stats.avgCloseHours} ชม.`}</div>
          <p className="text-xs text-muted-foreground">นับจากวันเริ่มงานถึงวันปิดงาน</p>
        </Card>
        <Card className="p-4 shadow-card space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><RotateCcw className="h-4 w-4 text-rose-400" /> แก้ไขซ้ำ</div>
          <div className="text-3xl font-bold">{stats.revisions}</div>
          <p className="text-xs text-muted-foreground">ครั้งที่ส่งกลับแก้ไข ใน {stats.reworked.length} งาน</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 shadow-card space-y-2">
          <h2 className="text-lg font-semibold text-red-400">เลยกำหนด ({stats.overdue.length})</h2>
          {list(stats.overdue, "ไม่มีงานเลยกำหนด")}
        </Card>
        <Card className="p-4 shadow-card space-y-2">
          <h2 className="text-lg font-semibold text-amber-400">ใกล้ครบกำหนด ({stats.dueSoon.length})</h2>
          {list(stats.dueSoon, "ไม่มีงานใกล้ครบกำหนด")}
        </Card>
      </div>

      <Card className="p-4 shadow-card space-y-3">
        <h2 className="text-lg font-semibold">ภาพรวมตามโครงการ</h2>
        <div className="space-y-3">
          {projects.filter((p) => projectId === "all" || p.id === projectId).map((p) => {
            const pt = db.tasks.filter((t) => t.projectId === p.id);
            const done = pt.filter((t) => t.status === "done").length;
            const od = pt.filter((t) => timeStatus(t, db.settings) === "overdue").length;
            return (
              <button key={p.id} onClick={() => navigate(`/projects/${p.id}/board`)} className="w-full text-left space-y-1 hover:bg-muted/40 rounded p-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{done}/{pt.length} เสร็จ{od ? <span className="text-red-400"> · {od} เลยกำหนด</span> : null}</span>
                </div>
                <Progress value={pt.length ? (done / pt.length) * 100 : 0} className="h-2" />
              </button>
            );
          })}
        </div>
      </Card>
    </AppLayout>
  );
}
