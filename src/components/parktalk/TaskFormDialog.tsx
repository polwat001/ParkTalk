import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CREATABLE_STATUSES, LABELS, PRIORITIES, PRIORITY_LABEL, RECURRENCE_LABEL, STATUS_LABEL } from "@/lib/parktalk/constants";
import { cn } from "@/lib/utils";
import { can, visibleProjects } from "@/lib/parktalk/permissions";
import { run } from "@/lib/parktalk/run";
import { createTask, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { fromLocalInput, toLocalInput } from "@/lib/parktalk/time";
import type { Priority, Recurrence, Task, TaskStatus } from "@/lib/parktalk/types";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  boardId?: string;
  dueDate?: Date;
  status?: TaskStatus;
  onCreated?: (task: Task) => void;
}

function defaultDue(date?: Date) {
  const d = date ? new Date(date) : new Date(Date.now() + 3 * 24 * 3600_000);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export function TaskFormDialog({ open, onOpenChange, projectId, boardId, dueDate, status, onCreated }: Props) {
  const db = useDb();
  const me = useCurrentUser();
  const projects = useMemo(
    () => visibleProjects(db, me).filter((p) => !p.archived && can(db, me, "createTask", p)),
    [db, me],
  );

  const [form, setForm] = useState({
    projectId: "",
    boardId: "",
    title: "",
    description: "",
    priority: "medium" as Priority,
    dueDate: "",
    startDate: "",
    assigneeId: NONE,
    reviewerId: NONE,
    openForClaim: false,
    recurrence: "none" as Recurrence,
    status: "todo" as TaskStatus,
    labels: [] as string[],
  });

  useEffect(() => {
    if (!open) return;
    const p = projects.find((x) => x.id === projectId) ?? projects[0];
    const leader = p?.members.find((m) => m.projectRole === "leader")?.userId ?? p?.members.find((m) => m.projectRole === "manager")?.userId;
    setForm({
      projectId: p?.id ?? "",
      boardId: boardId && p?.boards.some((b) => b.id === boardId) ? boardId : p?.boards[0]?.id ?? "",
      title: "",
      description: "",
      priority: "medium",
      dueDate: toLocalInput(defaultDue(dueDate)),
      startDate: "",
      assigneeId: NONE,
      reviewerId: leader && leader !== me?.id ? leader : NONE,
      openForClaim: false,
      recurrence: "none",
      status: status && CREATABLE_STATUSES.includes(status) ? status : "todo",
      labels: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const project = projects.find((p) => p.id === form.projectId);
  const members = (project?.members ?? []).map((m) => db.users.find((u) => u.id === m.userId)).filter((u) => u?.active);
  const canAssign = can(db, me, "assignTask", project);
  const assignable = canAssign ? members : members.filter((u) => u!.id === me?.id);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let created: Task | null = null;
    const ok = run(() => {
      created = createTask({
        projectId: form.projectId,
        boardId: form.boardId,
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: fromLocalInput(form.dueDate) ?? "",
        startDate: fromLocalInput(form.startDate),
        assigneeId: form.assigneeId === NONE ? null : form.assigneeId,
        reviewerId: form.reviewerId === NONE ? null : form.reviewerId,
        openForClaim: form.openForClaim,
        recurrence: form.recurrence,
        status: form.status,
        labels: form.labels,
      });
    }, "สร้างการ์ดเรียบร้อย");
    if (ok && created) {
      onOpenChange(false);
      onCreated?.(created);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สร้างการ์ดใหม่</DialogTitle>
          <DialogDescription>ช่องที่มี * ต้องระบุ — ผู้รับผิดชอบจะได้รับแจ้งเตือนทั้งในระบบและอีเมล</DialogDescription>
        </DialogHeader>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">คุณยังไม่มีสิทธิ์สร้างงานในโครงการใด</p>
        ) : (
          <form onSubmit={submit} className="space-y-4" id="task-form">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project *</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(v) => {
                    const p = projects.find((x) => x.id === v);
                    setForm((f) => ({ ...f, projectId: v, boardId: p?.boards[0]?.id ?? "", assigneeId: NONE, reviewerId: NONE }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Board *</Label>
                <Select value={form.boardId} onValueChange={(v) => set("boardId", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {project?.boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-title">ชื่องาน *</Label>
              <Input id="t-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={140} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">รายละเอียด</Label>
              <Textarea id="t-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ลิสต์</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CREATABLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ป้าย</Label>
                <div className="flex flex-wrap gap-1.5">
                  {LABELS.map((l) => {
                    const on = form.labels.includes(l.key);
                    return (
                      <button
                        key={l.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("labels", on ? form.labels.filter((x) => x !== l.key) : [...form.labels, l.key])}
                        className={cn("rounded-md px-2 py-1 text-xs font-medium border", on ? cn(l.chip, "border-current") : "border-border text-muted-foreground hover:bg-muted")}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Priority *</Label>
                <Select value={form.priority} onValueChange={(v) => set("priority", v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-start">วันเริ่มงาน</Label>
                <Input id="t-start" type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-due">Due Date *</Label>
                <Input id="t-due" type="datetime-local" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ผู้รับผิดชอบ</Label>
                <Select value={form.assigneeId} onValueChange={(v) => setForm((f) => ({ ...f, assigneeId: v, openForClaim: v === NONE ? f.openForClaim : false }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>ยังไม่มอบหมาย</SelectItem>
                    {assignable.map((u) => <SelectItem key={u!.id} value={u!.id}>{u!.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ผู้ตรวจรับ (Reviewer)</Label>
                <Select value={form.reviewerId} onValueChange={(v) => set("reviewerId", v)} disabled={!canAssign}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>ไม่ต้องตรวจรับ</SelectItem>
                    {members.map((u) => <SelectItem key={u!.id} value={u!.id}>{u!.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>งานเกิดซ้ำ</Label>
                <Select value={form.recurrence} onValueChange={(v) => set("recurrence", v as Recurrence)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => <SelectItem key={r} value={r}>{RECURRENCE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.assigneeId === NONE && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.openForClaim} onCheckedChange={(v) => set("openForClaim", v === true)} />
                เปิดให้สมาชิกกดรับงานเอง (Self-assignment)
              </label>
            )}
          </form>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button type="submit" form="task-form" disabled={!form.title.trim() || !form.dueDate || !form.boardId}>
            สร้างการ์ด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
