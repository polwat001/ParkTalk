import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarRange, FolderKanban, Plus, Trash2, UserPlus, Users } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL } from "@/lib/parktalk/constants";
import { can, visibleProjects } from "@/lib/parktalk/permissions";
import { run } from "@/lib/parktalk/run";
import { addMember, createProject, deleteBoard, removeMember, setMemberRole, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { fmtDate, timeStatus } from "@/lib/parktalk/time";
import type { ProjectMember } from "@/lib/parktalk/types";

const PROJECT_ROLE_LABEL: Record<ProjectMember["projectRole"], string> = {
  manager: "Project Manager",
  leader: "Team Leader",
  member: "สมาชิก",
};

export default function Projects() {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const projects = useMemo(() => visibleProjects(db, me), [db, me]);
  const manageId = params.get("manage");
  if (!me) return null;

  return (
    <AppLayout
      title="บอร์ดทั้งหมด"
      subtitle={`${projects.length} บอร์ด (โครงการ) ที่คุณเข้าถึงได้`}
      actions={
        can(db, me, "createProject") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> สร้าง Project
          </Button>
        )
      }
    >
      {projects.length === 0 ? (
        <EmptyState>คุณยังไม่ได้อยู่ในโครงการใด — ติดต่อ Project Manager เพื่อเพิ่มคุณเข้าโครงการ</EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const tasks = db.tasks.filter((t) => t.projectId === p.id);
            const done = tasks.filter((t) => t.status === "done").length;
            const overdue = tasks.filter((t) => timeStatus(t, db.settings) === "overdue").length;
            const owner = db.users.find((u) => u.id === p.ownerId);
            return (
              <Card key={p.id} className="p-5 space-y-4 shadow-card flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-gradient-primary grid place-items-center text-primary-foreground font-bold text-sm shrink-0">{p.key}</div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight truncate">{p.name}</h2>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description || "—"}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5"><CalendarRange className="h-3.5 w-3.5" />{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</div>
                  <div>Owner: {owner?.name ?? "—"} · {p.boards.length} Board</div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{done}/{tasks.length} เสร็จ</span>
                    {overdue > 0 && <span className="text-red-400 font-semibold">{overdue} เลยกำหนด</span>}
                  </div>
                  <Progress value={tasks.length ? (done / tasks.length) * 100 : 0} className="h-2" />
                </div>
                <div className="flex -space-x-2">
                  {p.members.slice(0, 7).map((m) => <UserAvatar key={m.userId} user={db.users.find((u) => u.id === m.userId)} size="xs" className="ring-2 ring-card" />)}
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button size="sm" className="flex-1" onClick={() => navigate(`/projects/${p.id}/board`)}>
                    <FolderKanban className="h-4 w-4" /> เปิดกระดาน
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setParams({ manage: p.id })}>
                    <Users className="h-4 w-4" /> สมาชิก
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/projects/${id}/board`)} />
      <ManageProjectDialog projectId={manageId} onClose={() => setParams({})} />
    </AppLayout>
  );
}

function CreateProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [form, setForm] = useState({ name: "", key: "", description: "", ownerId: "", startDate: "", endDate: "" });
  useEffect(() => {
    if (open) setForm({ name: "", key: "", description: "", ownerId: me?.id ?? "", startDate: new Date().toISOString().slice(0, 10), endDate: "" });
  }, [open, me?.id]);
  const owners = db.users.filter((u) => u.active && (u.role === "project_manager" || u.role === "super_admin"));
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let id = "";
    if (run(() => { id = createProject(form).id; }, "สร้างโครงการแล้ว")) {
      onOpenChange(false);
      onCreated(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>สร้าง Project ใหม่</DialogTitle>
          <DialogDescription>สร้างแล้วจะมี Board "Main" ให้ 1 Board เพิ่มได้ภายหลัง</DialogDescription>
        </DialogHeader>
        <form id="project-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-name">ชื่อโครงการ *</Label>
              <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-key">รหัส *</Label>
              <Input id="p-key" value={form.key} maxLength={5} onChange={(e) => set("key", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} placeholder="WEB" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">รายละเอียด</Label>
            <Textarea id="p-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Owner (Project Manager)</Label>
            <Select value={form.ownerId} onValueChange={(v) => set("ownerId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{owners.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-start">วันเริ่ม</Label>
              <Input id="p-start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-end">วันสิ้นสุด</Label>
              <Input id="p-end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button type="submit" form="project-form" disabled={!form.name.trim() || form.key.length < 2}>สร้างโครงการ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageProjectDialog({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const project = db.projects.find((p) => p.id === projectId);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState<ProjectMember["projectRole"]>("member");
  if (!project || !me) return null;
  const canInvite = can(db, me, "inviteMember", project);
  const canSetRole = can(db, me, "createProject", project);
  const canBoards = can(db, me, "createBoard", project);
  const outsiders = db.users.filter((u) => u.active && !project.members.some((m) => m.userId === u.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สมาชิกและ Board · {project.name}</DialogTitle>
          <DialogDescription>พนักงานหนึ่งคนอยู่ได้หลายโครงการ — ถอดสมาชิกแล้วงานที่ค้างจะกลับเป็น "ยังไม่มอบหมาย"</DialogDescription>
        </DialogHeader>
        <ul className="divide-y">
          {project.members.map((m) => {
            const u = db.users.find((x) => x.id === m.userId);
            if (!u) return null;
            const load = db.tasks.filter((t) => t.projectId === project.id && t.assigneeId === u.id && !["done", "documents"].includes(t.status)).length;
            return (
              <li key={m.userId} className="flex items-center gap-3 py-2">
                <UserAvatar user={u} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{u.name} {!u.active && <span className="text-xs text-muted-foreground">(ปิดบัญชี)</span>}</div>
                  <div className="text-xs text-muted-foreground truncate">{ROLE_LABEL[u.role]} · งานค้าง {load}</div>
                </div>
                {canSetRole && m.userId !== project.ownerId ? (
                  <Select value={m.projectRole} onValueChange={(v) => run(() => setMemberRole(project.id, u.id, v as ProjectMember["projectRole"]), "เปลี่ยนบทบาทแล้ว")}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(PROJECT_ROLE_LABEL) as ProjectMember["projectRole"][]).map((r) => <SelectItem key={r} value={r}>{PROJECT_ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs rounded-full bg-muted px-2 py-0.5">{m.userId === project.ownerId ? "Owner" : PROJECT_ROLE_LABEL[m.projectRole]}</span>
                )}
                {canInvite && m.userId !== project.ownerId && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`ถอด ${u.name}`} onClick={() => run(() => removeMember(project.id, u.id), `ถอด ${u.name} แล้ว`)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {canInvite && outsiders.length > 0 && (
          <div className="flex flex-wrap gap-2 items-end border-t pt-4">
            <div className="space-y-2 flex-1 min-w-40">
              <Label>เพิ่มสมาชิก</Label>
              <Select value={newUser} onValueChange={setNewUser}>
                <SelectTrigger><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
                <SelectContent>{outsiders.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} · {u.department}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {canSetRole && (
              <Select value={newRole} onValueChange={(v) => setNewRole(v as ProjectMember["projectRole"])}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PROJECT_ROLE_LABEL) as ProjectMember["projectRole"][]).map((r) => <SelectItem key={r} value={r}>{PROJECT_ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button disabled={!newUser} onClick={() => run(() => addMember(project.id, newUser, canSetRole ? newRole : "member"), "เพิ่มสมาชิกแล้ว") && setNewUser("")}>
              <UserPlus className="h-4 w-4" /> เพิ่ม
            </Button>
          </div>
        )}
        <div className="border-t pt-4 space-y-2">
          <h3 className="text-sm font-semibold">Boards</h3>
          <ul className="flex flex-wrap gap-2">
            {project.boards.map((b) => (
              <li key={b.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                {b.name}
                {canBoards && project.boards.length > 1 && (
                  <button className="text-muted-foreground hover:text-destructive" aria-label={`ลบ Board ${b.name}`} onClick={() => run(() => deleteBoard(project.id, b.id), "ลบ Board แล้ว")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
