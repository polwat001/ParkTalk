import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  ExternalLink,
  Hand,
  Link2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { PriorityBadge, StatusBadge, TimeBadge } from "@/components/parktalk/Badges";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { ReasonDialog } from "@/components/parktalk/ReasonDialog";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LABELS, PRIORITIES, PRIORITY_LABEL, RECURRENCE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/parktalk/constants";
import { cn } from "@/lib/utils";
import { can, canEditTask, canViewProject, moveDeniedReason, moveKind } from "@/lib/parktalk/permissions";
import { run } from "@/lib/parktalk/run";
import {
  addAttachment,
  addChecklistItem,
  addComment,
  assignTask,
  changeDueDate,
  claimTask,
  deleteTask,
  moveTask,
  removeAttachment,
  removeChecklistItem,
  toggleChecklistItem,
  updateTask,
  useCurrentUser,
  useDb,
} from "@/lib/parktalk/store";
import { fmtDateTime, fromLocalInput, relativeDue, timeStatus, toLocalInput } from "@/lib/parktalk/time";
import type { Priority, Recurrence, TaskStatus, User } from "@/lib/parktalk/types";

const NONE = "__none__";

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = useDb();
  const me = useCurrentUser();
  const task = db.tasks.find((t) => t.id === id);
  const project = task ? db.projects.find((p) => p.id === task.projectId) : undefined;

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [checkText, setCheckText] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [comment, setComment] = useState("");
  const [due, setDue] = useState("");
  const [pendingAssignee, setPendingAssignee] = useState<string | null | undefined>(undefined);
  const [dueReasonOpen, setDueReasonOpen] = useState(false);
  const [revisionTo, setRevisionTo] = useState<TaskStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (task) setDue(toLocalInput(task.dueDate));
  }, [task?.dueDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return null;
  if (!task || !project || !canViewProject(db, me, project)) {
    return (
      <AppLayout title="ไม่พบงาน">
        <EmptyState>
          ไม่พบงาน {id} หรือคุณไม่มีสิทธิ์เข้าถึง — <Link className="underline" to="/my-tasks">กลับไปงานของฉัน</Link>
        </EmptyState>
      </AppLayout>
    );
  }

  const userOf = (uid: string | null) => db.users.find((u) => u.id === uid) ?? null;
  const members = project.members.map((m) => userOf(m.userId)).filter((u) => u && u.active);
  const editable = canEditTask(db, me, task);
  const canAssign = can(db, me, "assignTask", project);
  const canDue = can(db, me, "changeDueDate", project);
  const canDelete = can(db, me, "editOthersTask", project) || task.createdBy === me.id;
  const ts = timeStatus(task, db.settings);
  const doneCount = task.checklist.filter((c) => c.done).length;
  const allowed = (s: TaskStatus) => !moveDeniedReason(db, me, task, s);

  const move = (s: TaskStatus, msg: string) => run(() => moveTask(task.id, s), msg);

  const actions: { key: string; label: string; icon: typeof Play; variant?: "default" | "industrial" | "outline" | "destructive"; onClick: () => void; show: boolean }[] = [
    { key: "start", label: "เริ่มงาน", icon: Play, onClick: () => move("in_progress", "เริ่มงานแล้ว"), show: ["open", "todo", "standby"].includes(task.status) && allowed("in_progress") },
    { key: "review", label: "ส่งตรวจ (Review)", icon: Send, onClick: () => move("review", "ส่งตรวจแล้ว — แจ้งผู้ตรวจรับเรียบร้อย"), show: task.status === "in_progress" && !!task.reviewerId && allowed("review") },
    { key: "finish", label: "ปิดงาน", icon: CheckCircle2, variant: "industrial", onClick: () => move("done", "ปิดงานแล้ว"), show: ["in_progress", "deploy"].includes(task.status) && allowed("done") },
    { key: "approve", label: "ผ่านการตรวจ → Testing", icon: CheckCircle2, variant: "industrial", onClick: () => move("testing", "ผ่านการตรวจแล้ว"), show: task.status === "review" && allowed("testing") },
    { key: "approve-done", label: "ผ่านการตรวจ / ปิดงาน", icon: CheckCircle2, variant: "outline", onClick: () => move("done", "ตรวจรับและปิดงานแล้ว"), show: task.status === "review" && allowed("done") },
    { key: "revise", label: "ส่งกลับแก้ไข", icon: RotateCcw, variant: "destructive", onClick: () => setRevisionTo("in_progress"), show: task.status === "review" && allowed("in_progress") },
    { key: "deploy", label: "ส่ง Deploy", icon: Send, onClick: () => move("deploy", "ย้ายไป Deploy แล้ว"), show: task.status === "testing" && allowed("deploy") },
    { key: "reopen", label: "เปิดงานใหม่", icon: Undo2, variant: "outline", onClick: () => move("todo", "เปิดงานใหม่แล้ว"), show: task.status === "done" && allowed("todo") },
  ];

  const saveText = () => {
    if (run(() => updateTask(task.id, { title, description }), "บันทึกแล้ว")) setEditing(false);
  };

  const onAssigneeChange = (v: string) => {
    const next = v === NONE ? null : v;
    if (next === task.assigneeId) return;
    if (task.assigneeId) setPendingAssignee(next);
    else run(() => assignTask(task.id, next, ""), "มอบหมายงานแล้ว — ส่งแจ้งเตือนแล้ว");
  };

  return (
    <AppLayout
      title={`${task.id} · ${task.title}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${project.id}/board?board=${task.boardId}`)}>
            <ArrowLeft className="h-4 w-4" /> กระดาน {project.name}
          </Button>
          {canDelete && (
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> ลบงาน
            </Button>
          )}
        </>
      }
    >
      <div className="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        {/* main column */}
        <div className="space-y-5 min-w-0">
          <Card className="p-5 space-y-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{task.id}</span>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <TimeBadge status={ts} label={ts === "none" ? `ปิดงาน ${fmtDateTime(task.completedAt)}` : relativeDue(task.dueDate)} />
              {task.revisionCount > 0 && <span className="text-xs text-rose-300">ส่งกลับแก้ไข {task.revisionCount} ครั้ง</span>}
              {task.inRevision && <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-300">ต้องแก้ไขแล้วส่งตรวจใหม่</span>}
              {task.reviewerId && task.approvedAt && task.status !== "review" && <span className="text-xs text-emerald-300">ผ่าน Review แล้ว</span>}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ed-title">ชื่องาน</Label>
                  <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-desc">รายละเอียด</Label>
                  <Textarea id="ed-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveText} disabled={!title.trim()}>บันทึก</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>ยกเลิก</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-2xl font-bold leading-tight">{task.title}</h2>
                  {editable && (
                    <Button size="sm" variant="ghost" onClick={() => { setTitle(task.title); setDescription(task.description); setEditing(true); }}>
                      <Pencil className="h-4 w-4" /> แก้ไข
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{task.description || <span className="text-muted-foreground">ไม่มีรายละเอียด</span>}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {actions.filter((a) => a.show).map((a) => (
                <Button key={a.key} size="sm" variant={a.variant ?? "default"} onClick={a.onClick}>
                  <a.icon className="h-4 w-4" /> {a.label}
                </Button>
              ))}
              {!task.assigneeId && task.openForClaim && can(db, me, "selfAssign", project) && (
                <Button size="sm" variant="industrial" onClick={() => run(() => claimTask(task.id), "รับงานแล้ว")}>
                  <Hand className="h-4 w-4" /> รับงานนี้
                </Button>
              )}
            </div>
          </Card>

          {/* Checklist */}
          <Card className="p-5 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Checklist</h3>
              <span className="text-sm text-muted-foreground">{doneCount}/{task.checklist.length}</span>
            </div>
            {task.checklist.length > 0 && <Progress value={(doneCount / task.checklist.length) * 100} className="h-2" />}
            <ul className="space-y-1">
              {task.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-2 group rounded-md px-1 py-1 hover:bg-muted/50">
                  <Checkbox id={c.id} checked={c.done} disabled={!editable} onCheckedChange={() => run(() => toggleChecklistItem(task.id, c.id))} />
                  <label htmlFor={c.id} className={`flex-1 text-sm cursor-pointer ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</label>
                  {editable && (
                    <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => run(() => removeChecklistItem(task.id, c.id))} aria-label={`ลบ ${c.text}`}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {editable && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (run(() => addChecklistItem(task.id, checkText))) setCheckText(""); }}>
                <Input value={checkText} onChange={(e) => setCheckText(e.target.value)} placeholder="เพิ่มรายการงานย่อย..." className="h-9" />
                <Button type="submit" size="sm" variant="outline" disabled={!checkText.trim()}><Plus className="h-4 w-4" /> เพิ่ม</Button>
              </form>
            )}
          </Card>

          {/* Attachments */}
          <Card className="p-5 space-y-3 shadow-card">
            <h3 className="text-lg font-semibold">ไฟล์และลิงก์แนบ</h3>
            {task.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีไฟล์แนบ</p>
            ) : (
              <ul className="space-y-1">
                {task.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={a.url} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-4 hover:underline truncate">{a.name}</a>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">{userOf(a.addedBy)?.name}</span>
                    {editable && (
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => run(() => removeAttachment(task.id, a.id))} aria-label="ลบไฟล์แนบ">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <form className="grid sm:grid-cols-[1fr_1.5fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (run(() => addAttachment(task.id, linkName, linkUrl))) { setLinkName(""); setLinkUrl(""); } }}>
                <Input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="ชื่อไฟล์ / เอกสาร" className="h-9" />
                <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="h-9" />
                <Button type="submit" size="sm" variant="outline" disabled={!linkUrl.trim()}><Plus className="h-4 w-4" /> แนบ</Button>
              </form>
            )}
          </Card>

          {/* Comments & activity */}
          <Card className="p-5 shadow-card">
            <Tabs defaultValue="comments">
              <TabsList>
                <TabsTrigger value="comments">ความคิดเห็น ({task.comments.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity Log ({task.activity.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="space-y-4 pt-2">
                {task.comments.map((c) => {
                  const u = userOf(c.userId);
                  return (
                    <div key={c.id} className="flex gap-3">
                      <UserAvatar user={u} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm"><span className="font-semibold">{u?.name}</span> <span className="text-xs text-muted-foreground">{fmtDateTime(c.createdAt)}</span></div>
                        <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (run(() => addComment(task.id, comment))) setComment(""); }}>
                  <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="พิมพ์ความคิดเห็น... ใช้ปุ่ม @ เพื่อกล่าวถึงสมาชิก" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                    {members.filter((u) => u!.id !== me.id).map((u) => (
                      <button key={u!.id} type="button" className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted" onClick={() => setComment((c) => `${c}${c && !c.endsWith(" ") ? " " : ""}@${u!.name} `)}>
                        {u!.name}
                      </button>
                    ))}
                    <Button type="submit" size="sm" className="ml-auto" disabled={!comment.trim()}><Send className="h-4 w-4" /> ส่ง</Button>
                  </div>
                </form>
              </TabsContent>
              <TabsContent value="activity" className="pt-2">
                <ol className="relative border-l pl-4 space-y-3">
                  {task.activity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-muted-foreground/40" />
                      <span className="font-semibold">{userOf(a.userId)?.name ?? "ระบบ"}</span> {a.text}
                      <div className="text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</div>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* side column */}
        <Card className="p-5 space-y-4 shadow-card lg:sticky lg:top-0">
          <Field label="สถานะ">
            <Select value={task.status} onValueChange={(v) => (moveKind(task, v as TaskStatus) === "revision" ? setRevisionTo(v as TaskStatus) : move(v as TaskStatus, `ย้ายไป ${STATUS_LABEL[v as TaskStatus]}`))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s} disabled={s !== task.status && !allowed(s)}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ผู้รับผิดชอบหลัก">
            {canAssign ? (
              <Select value={task.assigneeId ?? NONE} onValueChange={onAssigneeChange}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ยังไม่มอบหมาย</SelectItem>
                  {members.map((u) => <SelectItem key={u!.id} value={u!.id}>{u!.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <PersonRow user={userOf(task.assigneeId)} empty={task.openForClaim ? "เปิดให้รับงาน" : "ยังไม่มอบหมาย"} />
            )}
          </Field>
          <Field label="ผู้ร่วมงาน">
            <div className="flex flex-wrap gap-1.5">
              {task.collaboratorIds.map((cid) => <span key={cid} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">{userOf(cid)?.name}</span>)}
              {task.collaboratorIds.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
              {canAssign && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"><Pencil className="h-3 w-3" /> แก้ไข</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-1">
                    {members.filter((u) => u!.id !== task.assigneeId).map((u) => (
                      <label key={u!.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-1 hover:bg-muted">
                        <Checkbox
                          checked={task.collaboratorIds.includes(u!.id)}
                          onCheckedChange={(v) =>
                            run(() => updateTask(task.id, { collaboratorIds: v ? [...task.collaboratorIds, u!.id] : task.collaboratorIds.filter((x) => x !== u!.id) }))
                          }
                        />
                        {u!.name}
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </Field>
          <Field label="ผู้ตรวจรับ (Reviewer)">
            {canAssign ? (
              <Select value={task.reviewerId ?? NONE} onValueChange={(v) => run(() => updateTask(task.id, { reviewerId: v === NONE ? null : v }), "เปลี่ยนผู้ตรวจรับแล้ว")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ไม่ต้องตรวจรับ</SelectItem>
                  {members.map((u) => <SelectItem key={u!.id} value={u!.id}>{u!.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <PersonRow user={userOf(task.reviewerId)} empty="ไม่ต้องตรวจรับ" />
            )}
          </Field>
          <Field label="Due Date">
            {canDue ? (
              <div className="flex gap-2">
                <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="h-9" />
                <Button size="sm" variant="outline" disabled={!due || toLocalInput(task.dueDate) === due} onClick={() => setDueReasonOpen(true)}>บันทึก</Button>
              </div>
            ) : (
              <p className="text-sm">{fmtDateTime(task.dueDate)}</p>
            )}
          </Field>
          <Field label="ป้าย">
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map((l) => {
                const on = task.labels.includes(l.key);
                if (!editable && !on) return null;
                return (
                  <button
                    key={l.key}
                    type="button"
                    disabled={!editable}
                    aria-pressed={on}
                    onClick={() => run(() => updateTask(task.id, { labels: on ? task.labels.filter((x) => x !== l.key) : [...task.labels, l.key] }))}
                    className={cn("rounded-md px-2 py-0.5 text-xs font-medium border", on ? cn(l.chip, "border-current") : "border-border text-muted-foreground hover:bg-muted")}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Priority">
            <Select value={task.priority} disabled={!editable} onValueChange={(v) => run(() => updateTask(task.id, { priority: v as Priority }), "เปลี่ยน Priority แล้ว")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Board">
            <Select value={task.boardId} disabled={!editable} onValueChange={(v) => run(() => updateTask(task.id, { boardId: v }), "ย้าย Board แล้ว")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{project.boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="งานเกิดซ้ำ">
            <Select value={task.recurrence} disabled={!editable} onValueChange={(v) => run(() => updateTask(task.id, { recurrence: v as Recurrence }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => <SelectItem key={r} value={r}>{RECURRENCE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {!task.assigneeId && canAssign && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={task.openForClaim} onCheckedChange={(v) => run(() => updateTask(task.id, { openForClaim: v === true }))} />
              เปิดให้สมาชิกกดรับงานเอง
            </label>
          )}
          <dl className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <div className="flex justify-between"><dt>วันเริ่มงาน</dt><dd>{fmtDateTime(task.startDate)}</dd></div>
            <div className="flex justify-between"><dt>สร้างโดย</dt><dd>{userOf(task.createdBy)?.name}</dd></div>
            <div className="flex justify-between"><dt>สร้างเมื่อ</dt><dd>{fmtDateTime(task.createdAt)}</dd></div>
            <div className="flex justify-between"><dt>อัปเดตล่าสุด</dt><dd>{fmtDateTime(task.updatedAt)}</dd></div>
          </dl>
        </Card>
      </div>

      <ReasonDialog
        open={pendingAssignee !== undefined}
        onOpenChange={(o) => !o && setPendingAssignee(undefined)}
        title={`โยกย้ายงานไปให้ ${userOf(pendingAssignee ?? null)?.name ?? "ไม่มีผู้รับผิดชอบ"}`}
        description="ผู้รับงานเดิมและผู้รับงานใหม่จะได้รับแจ้งเตือนพร้อมเหตุผล"
        confirmLabel="โยกย้ายงาน"
        onConfirm={(reason) => run(() => assignTask(task.id, pendingAssignee ?? null, reason), "โยกย้ายงานแล้ว")}
      />
      <ReasonDialog
        open={dueReasonOpen}
        onOpenChange={setDueReasonOpen}
        title="เปลี่ยนกำหนดส่ง"
        description={`${fmtDateTime(task.dueDate)} → ${due ? fmtDateTime(fromLocalInput(due)) : "—"}`}
        confirmLabel="บันทึกกำหนดส่ง"
        onConfirm={(reason) => run(() => changeDueDate(task.id, fromLocalInput(due) ?? "", reason), "เปลี่ยนกำหนดส่งแล้ว")}
      />
      <ReasonDialog
        open={!!revisionTo}
        onOpenChange={(o) => !o && setRevisionTo(null)}
        title={`ส่งกลับแก้ไข ${task.id}`}
        description={`ย้ายกลับไป ${revisionTo ? STATUS_LABEL[revisionTo] : ""} — ผู้รับผิดชอบจะได้รับแจ้งเตือนพร้อมเหตุผล`}
        confirmLabel="ส่งกลับแก้ไข"
        onConfirm={(reason) => revisionTo && run(() => moveTask(task.id, revisionTo, reason), "ส่งกลับแก้ไขแล้ว")}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบงาน {task.id}?</AlertDialogTitle>
            <AlertDialogDescription>"{task.title}" จะถูกลบถาวร (บันทึกไว้ใน Audit Log)</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(() => deleteTask(task.id), "ลบงานแล้ว") && navigate(`/projects/${project.id}/board`)}
            >
              ลบงาน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function PersonRow({ user, empty }: { user: User | null; empty: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <UserAvatar user={user} size="xs" />
      {user ? user.name : <span className="text-muted-foreground">{empty}</span>}
    </div>
  );
}
