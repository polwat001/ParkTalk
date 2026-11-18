import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hand, Plus, Search } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { TaskCard } from "@/components/parktalk/TaskCard";
import { TaskFormDialog } from "@/components/parktalk/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can, visibleProjects } from "@/lib/parktalk/permissions";
import { run } from "@/lib/parktalk/run";
import { claimTask, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { timeStatus } from "@/lib/parktalk/time";
import type { Task } from "@/lib/parktalk/types";

export default function MyTasks() {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { groups, claimable, done } = useMemo(() => {
    if (!me) return { groups: [], claimable: [], done: [] };
    const q = search.trim().toLowerCase();
    const match = (t: Task) => !q || `${t.id} ${t.title}`.toLowerCase().includes(q);
    const mine = db.tasks.filter((t) => (t.assigneeId === me.id || t.collaboratorIds.includes(me.id)) && match(t)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const open = mine.filter((t) => !["done", "documents"].includes(t.status));
    const projects = visibleProjects(db, me);
    return {
      groups: [
        { key: "overdue", title: "เลยกำหนด", tone: "text-red-400", items: open.filter((t) => timeStatus(t, db.settings) === "overdue") },
        { key: "due_soon", title: "ใกล้ครบกำหนด", tone: "text-amber-400", items: open.filter((t) => timeStatus(t, db.settings) === "due_soon") },
        { key: "review", title: "รอฉันตรวจรับ", tone: "text-violet-400", items: db.tasks.filter((t) => t.status === "review" && t.reviewerId === me.id && match(t)) },
        { key: "on_track", title: "ตามแผน", tone: "text-emerald-300", items: open.filter((t) => timeStatus(t, db.settings) === "on_track") },
      ],
      claimable: db.tasks.filter(
        (t) => !t.assigneeId && t.openForClaim && t.status !== "done" && match(t) && projects.some((p) => p.id === t.projectId && can(db, me, "selfAssign", p)),
      ),
      done: mine.filter((t) => t.status === "done").reverse(),
    };
  }, [db, me, search]);

  if (!me) return null;
  const openCount = groups.filter((g) => g.key !== "review").reduce((a, g) => a + g.items.length, 0);

  const grid = (items: Task[], claim = false) =>
    items.length === 0 ? null : (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((t) => (
          <TaskCard key={t.id} task={t} db={db} me={me} showProject canClaim={claim} onClaim={(id) => run(() => claimTask(id), `รับงาน ${id} แล้ว`)} onOpen={(id) => navigate(`/tasks/${id}`)} />
        ))}
      </div>
    );

  return (
    <AppLayout
      title="งานของฉัน"
      subtitle="งานที่คุณเป็นผู้รับผิดชอบหรือผู้ร่วมงาน เรียงตามกำหนดส่ง"
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหางาน..." className="pl-9 h-9 bg-card w-56" />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> สร้าง Task</Button>
        </>
      }
    >
      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">กำลังดำเนินการ ({openCount})</TabsTrigger>
          <TabsTrigger value="claim"><Hand className="h-3.5 w-3.5 mr-1" />เปิดให้รับ ({claimable.length})</TabsTrigger>
          <TabsTrigger value="done">เสร็จแล้ว ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-6 pt-3">
          {groups.every((g) => g.items.length === 0) && <EmptyState>ไม่มีงานค้าง 🎉</EmptyState>}
          {groups.map((g) =>
            g.items.length ? (
              <section key={g.key} className="space-y-2">
                <h2 className={`text-lg font-semibold ${g.tone}`}>{g.title} <span className="text-sm text-muted-foreground">({g.items.length})</span></h2>
                {grid(g.items)}
              </section>
            ) : null,
          )}
        </TabsContent>
        <TabsContent value="claim" className="pt-3">
          {grid(claimable, true) ?? <EmptyState>ยังไม่มีงานที่เปิดให้รับในโครงการของคุณ</EmptyState>}
        </TabsContent>
        <TabsContent value="done" className="pt-3">
          {grid(done) ?? <EmptyState>ยังไม่มีงานที่ปิดแล้ว</EmptyState>}
        </TabsContent>
      </Tabs>
      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}
