import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/parktalk/AppLayout";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { PriorityBadge, TimeBadge } from "@/components/parktalk/Badges";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABEL, STATUS_LABEL } from "@/lib/parktalk/constants";
import { can, visibleProjects } from "@/lib/parktalk/permissions";
import { useCurrentUser, useDb } from "@/lib/parktalk/store";
import { relativeDue, timeStatus } from "@/lib/parktalk/time";
import type { TaskStatus } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const ALL = "all";
const BAR: Partial<Record<TaskStatus, string>> = {
  open: "bg-slate-400",
  todo: "bg-sky-500",
  in_progress: "bg-amber-500",
  review: "bg-violet-500",
  testing: "bg-cyan-500",
  deploy: "bg-fuchsia-500",
  standby: "bg-orange-500",
};

export default function Workload() {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(ALL);
  const projects = useMemo(() => visibleProjects(db, me).filter((p) => can(db, me, "assignTask", p)), [db, me]);

  const rows = useMemo(() => {
    const ps = projectId === ALL ? projects : projects.filter((p) => p.id === projectId);
    const ids = [...new Set(ps.flatMap((p) => p.members.map((m) => m.userId)))];
    return ids
      .map((id) => db.users.find((u) => u.id === id))
      .filter((u) => u && u.active)
      .map((u) => {
        const open = db.tasks.filter((t) => ps.some((p) => p.id === t.projectId) && t.assigneeId === u!.id && !["done", "documents"].includes(t.status));
        const byStatus = Object.fromEntries(Object.keys(BAR).map((s) => [s, open.filter((t) => t.status === s).length])) as Record<string, number>;
        return {
          user: u!,
          open,
          byStatus,
          overdue: open.filter((t) => timeStatus(t, db.settings) === "overdue").length,
          dueSoon: open.filter((t) => timeStatus(t, db.settings) === "due_soon").length,
          critical: open.filter((t) => t.priority === "critical" || t.priority === "high").length,
        };
      })
      .sort((a, b) => b.open.length - a.open.length);
  }, [db, projects, projectId]);

  if (!me) return null;
  const max = Math.max(1, ...rows.map((r) => r.open.length));

  return (
    <AppLayout
      title="ภาระงานทีม"
      subtitle="จำนวนงานในมือของแต่ละคน ใช้ประกอบการตัดสินใจมอบหมายงาน"
      actions={
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกโครงการที่ดูแล</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      {!can(db, me, "assignTask") ? (
        <EmptyState>หน้านี้สำหรับผู้มีสิทธิ์มอบหมายงาน</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>ยังไม่มีสมาชิกในโครงการที่คุณดูแล</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.user.id} className="p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-3">
                <UserAvatar user={r.user} size="md" />
                <div className="min-w-40">
                  <div className="font-semibold">{r.user.name}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_LABEL[r.user.role]} · {r.user.department}</div>
                </div>
                <div className="flex-1 min-w-48 space-y-1">
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted" style={{ width: `${Math.max(8, (r.open.length / max) * 100)}%` }}>
                    {Object.entries(r.byStatus).map(([s, n]) =>
                      n ? <div key={s} className={BAR[s as TaskStatus]} style={{ width: `${(n / r.open.length) * 100}%` }} title={`${STATUS_LABEL[s as TaskStatus]}: ${n}`} /> : null,
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(r.byStatus).filter(([, n]) => n).map(([s, n]) => `${STATUS_LABEL[s as TaskStatus]} ${n}`).join(" · ") || "ไม่มีงานค้าง"}
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <Stat label="งานในมือ" value={r.open.length} />
                  <Stat label="เลยกำหนด" value={r.overdue} tone={r.overdue ? "text-red-400" : undefined} />
                  <Stat label="ใกล้ครบ" value={r.dueSoon} tone={r.dueSoon ? "text-amber-400" : undefined} />
                  <Stat label="High+" value={r.critical} />
                </div>
              </div>
              {r.open.length > 0 && (
                <ul className="mt-3 grid md:grid-cols-2 gap-1.5">
                  {[...r.open].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6).map((t) => {
                    const ts = timeStatus(t, db.settings);
                    return (
                      <li key={t.id}>
                        <button onClick={() => navigate(`/tasks/${t.id}`)} className="w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted/50">
                          <span className="font-mono text-xs text-muted-foreground shrink-0">{t.id}</span>
                          <span className="truncate flex-1">{t.title}</span>
                          <PriorityBadge priority={t.priority} className="hidden sm:inline-flex" />
                          <TimeBadge status={ts} label={relativeDue(t.dueDate)} className="shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={cn("text-xl font-bold", tone)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
