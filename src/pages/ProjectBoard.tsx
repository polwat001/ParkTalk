import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Code2,
  Filter,
  GanttChart,
  History,
  Inbox,
  KanbanSquare,
  MoreHorizontal,
  Plus,
  Star,
  Table2,
  Users,
  X,
  Zap,
} from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { BoardTable } from "@/components/parktalk/BoardTable";
import { BoardTimeline } from "@/components/parktalk/BoardTimeline";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { ReasonDialog } from "@/components/parktalk/ReasonDialog";
import { TaskCard } from "@/components/parktalk/TaskCard";
import { TaskFormDialog } from "@/components/parktalk/TaskFormDialog";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  CREATABLE_STATUSES,
  LABELS,
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_TH,
  TIME_STATUS_LABEL,
} from "@/lib/parktalk/constants";
import { can, canViewProject, moveDeniedReason, moveKind, visibleProjects } from "@/lib/parktalk/permissions";
import { run } from "@/lib/parktalk/run";
import { claimTask, createBoard, createTask, moveTask, reorderList, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { fmtDateTime, timeStatus } from "@/lib/parktalk/time";
import type { Priority, Task, TaskStatus, TimeStatus } from "@/lib/parktalk/types";
import { useCardDrag, type DropTarget } from "@/lib/parktalk/useCardDrag";
import { useDragPan } from "@/lib/parktalk/useDragPan";
import { cn } from "@/lib/utils";

const ALL = "all";
const FAV_KEY = "parktalk_fav_projects";

interface Filters {
  q: string;
  assignee: string;
  priority: "all" | Priority;
  time: "all" | TimeStatus;
  labels: string[];
}
const NO_FILTERS: Filters = { q: "", assignee: ALL, priority: ALL, time: ALL, labels: [] };

function readFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function defaultDue(status: TaskStatus) {
  const d = new Date(Date.now() + (status === "documents" ? 60 : 3) * 24 * 3600_000);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const db = useDb();
  const me = useCurrentUser();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [composer, setComposer] = useState<TaskStatus | null>(null);
  const [revision, setRevision] = useState<{ id: string; target: DropTarget } | null>(null);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [favs, setFavs] = useState<string[]>(readFavs);

  const project = db.projects.find((p) => p.id === id);
  const boardId = params.get("board") ?? ALL;
  const viewParam = params.get("view");
  const view: "board" | "table" | "timeline" = viewParam === "timeline" || viewParam === "table" ? viewParam : "board";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const tasks = useMemo(() => {
    if (!project || !me) return [];
    const q = filters.q.trim().toLowerCase();
    return db.tasks
      .filter((t) => t.projectId === project.id && (boardId === ALL || t.boardId === boardId))
      .filter((t) =>
        filters.assignee === ALL
          ? true
          : filters.assignee === "mine"
            ? t.assigneeId === me.id || t.collaboratorIds.includes(me.id)
            : filters.assignee === "unassigned"
              ? !t.assigneeId
              : t.assigneeId === filters.assignee,
      )
      .filter((t) => filters.priority === ALL || t.priority === filters.priority)
      .filter((t) => filters.time === ALL || timeStatus(t, db.settings) === filters.time)
      .filter((t) => !filters.labels.length || t.labels.some((l) => filters.labels.includes(l)))
      .filter((t) => !q || `${t.id} ${t.title} ${t.description}`.toLowerCase().includes(q))
      .sort((a, b) => a.order - b.order);
  }, [db, project, me, boardId, filters]);

  useDragPan(scrollerRef, view === "board");

  const { drag, startDrag, guardClick } = useCardDrag(scrollerRef, (taskId, target) => requestMove(taskId, target));

  /** Shared by drag-and-drop and the table's list column. */
  function requestMove(taskId: string, target: DropTarget) {
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task || !me) return;
    const denied = moveDeniedReason(db, me, task, target.status);
    if (denied) return void run(() => { throw new Error(denied); });
    if (moveKind(task, target.status) === "revision") return setRevision({ id: taskId, target });
    const sameSpot = task.status === target.status && (target.beforeId ?? null) === nextIdAfter(taskId, target.status);
    if (sameSpot) return;
    run(
      () => moveTask(taskId, target.status, "", target.beforeId),
      task.status === target.status ? undefined : `${taskId} → ${STATUS_LABEL[target.status]}`,
    );
  }

  // card currently right after `taskId` in its list (to skip no-op drops)
  const nextIdAfter = (taskId: string, status: TaskStatus) => {
    const list = db.tasks.filter((t) => t.projectId === project?.id && t.status === status).sort((a, b) => a.order - b.order);
    const i = list.findIndex((t) => t.id === taskId);
    return list[i + 1]?.id ?? null;
  };

  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    } catch {
      /* per-viewer convenience only */
    }
  }, [favs]);

  if (!me) return null;
  if (!project || !canViewProject(db, me, project)) {
    return (
      <AppLayout title="ไม่พบบอร์ด">
        <EmptyState>
          ไม่พบโครงการ หรือคุณไม่มีสิทธิ์เข้าถึง — <Link className="underline" to="/projects">กลับไปหน้าบอร์ดทั้งหมด</Link>
        </EmptyState>
      </AppLayout>
    );
  }

  const members = project.members.map((m) => db.users.find((u) => u.id === m.userId)).filter((u) => u?.active);
  const canCreate = can(db, me, "createTask", project);
  const canSelfAssign = can(db, me, "selfAssign", project);
  const canSort = can(db, me, "assignTask", project);
  const dragged = drag ? db.tasks.find((t) => t.id === drag.id) : null;
  const activeFilters =
    (filters.q ? 1 : 0) + (filters.assignee !== ALL ? 1 : 0) + (filters.priority !== ALL ? 1 : 0) + (filters.time !== ALL ? 1 : 0) + filters.labels.length;
  const starred = favs.includes(project.id);
  const reviewer = project.members.find((m) => m.projectRole === "leader")?.userId ?? project.members.find((m) => m.projectRole === "manager")?.userId ?? null;
  const currentBoard = boardId !== ALL ? boardId : project.boards[0]?.id;

  const quickAdd = (status: TaskStatus, title: string) =>
    run(() =>
      createTask({
        projectId: project.id,
        boardId: currentBoard,
        title,
        description: "",
        priority: "medium",
        dueDate: defaultDue(status),
        status,
        reviewerId: status === "documents" ? null : reviewer,
      }),
    );

  const sortList = (status: TaskStatus, by: "due" | "priority") => {
    const ids = db.tasks
      .filter((t) => t.projectId === project.id && t.status === status)
      .sort((a, b) => (by === "due" ? a.dueDate.localeCompare(b.dueDate) : PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueDate.localeCompare(b.dueDate)))
      .map((t) => t.id);
    run(() => reorderList(ids), by === "due" ? "เรียงตามกำหนดส่งแล้ว" : "เรียงตาม Priority แล้ว");
  };

  const activity = db.tasks
    .filter((t) => t.projectId === project.id)
    .flatMap((t) => t.activity.map((a) => ({ ...a, taskId: t.id, taskTitle: t.title })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 60);

  return (
    <AppLayout title={project.name} bare>
      <div className="flex-1 min-h-0 flex flex-col bg-board text-white relative">
        {/* Board header */}
        <div className="shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
              <Code2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xl font-bold hover:opacity-90" aria-label="เปลี่ยนบอร์ด">
                    <span className="truncate max-w-[16rem] sm:max-w-none">{project.name}</span>
                    <ChevronDown className="h-5 w-5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>บอร์ดของฉัน</DropdownMenuLabel>
                  {visibleProjects(db, me).map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => navigate(`/projects/${p.id}/board`)}>
                      {favs.includes(p.id) && <Star className="h-3.5 w-3.5 mr-1.5 fill-secondary text-secondary" />}
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/projects")}>ดูบอร์ดทั้งหมด</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-sm text-white/70 truncate max-w-[32rem]">{project.description || "—"}</p>
            </div>

            {/* sub-boards (Frontend / Backend / …) */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-white/5 p-1" role="tablist" aria-label="Board">
              {[{ id: ALL, name: "ทั้งหมด" }, ...project.boards].map((b) => (
                <button
                  key={b.id}
                  role="tab"
                  aria-selected={boardId === b.id}
                  onClick={() => setParam("board", b.id === ALL ? null : b.id)}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-medium", boardId === b.id ? "bg-white/15 text-white" : "text-white/60 hover:text-white")}
                >
                  {b.name}
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button className="hidden md:flex -space-x-2 mr-1" onClick={() => navigate(`/projects?manage=${project.id}`)} aria-label="ดูสมาชิก">
                {members.slice(0, 4).map((u) => <UserAvatar key={u!.id} user={u} className="ring-2 ring-[hsl(258_40%_20%)]" />)}
                {members.length > 4 && (
                  <span className="h-8 w-8 rounded-full bg-white/15 ring-2 ring-[hsl(258_40%_20%)] grid place-items-center text-xs font-semibold">+{members.length - 4}</span>
                )}
              </button>
              <HeaderButton onClick={() => navigate(`/projects?manage=${project.id}`)}>
                <Users className="h-4 w-4" /> สมาชิก
              </HeaderButton>
              <FilterPopover filters={filters} setFilters={setFilters} members={members.map((u) => ({ id: u!.id, name: u!.name }))} active={activeFilters} />
              <AutomationPopover isAdmin={can(db, me, "manageUsers")} />
              <button
                onClick={() => setFavs((f) => (starred ? f.filter((x) => x !== project.id) : [...f, project.id]))}
                className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10"
                aria-label={starred ? "เลิกติดดาว" : "ติดดาวบอร์ดนี้"}
                aria-pressed={starred}
              >
                <Star className={cn("h-5 w-5", starred ? "fill-secondary text-secondary" : "text-white/70")} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10" aria-label="เมนูบอร์ด">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {can(db, me, "createBoard", project) && <DropdownMenuItem onSelect={() => setNewBoardOpen(true)}>สร้าง Board ย่อย</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => navigate(`/projects?manage=${project.id}`)}>จัดการสมาชิกและ Board</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setActivityOpen(true)}>กิจกรรมล่าสุด</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {view !== "timeline" && (
          <div className="shrink-0 px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/20 p-1" role="tablist" aria-label="รูปแบบการแสดงผล">
              {([
                { key: "board", label: "บอร์ด", icon: KanbanSquare },
                { key: "table", label: "ตาราง", icon: Table2 },
              ] as const).map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={view === v.key}
                  onClick={() => setParam("view", v.key === "board" ? null : v.key)}
                  className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", view === v.key ? "bg-primary text-white" : "text-white/70 hover:text-white hover:bg-white/10")}
                >
                  <v.icon className="h-4 w-4" /> {v.label}
                </button>
              ))}
            </div>
            {view === "board" && <span className="hidden md:inline text-xs text-white/55 mr-auto">ลากการ์ดเพื่อย้ายลิสต์ · คลิกค้างที่พื้นที่ว่างแล้วลากเพื่อเลื่อนบอร์ด</span>}
            {canCreate && (
            <Button
              className="bg-gradient-primary hover:opacity-95 shadow-glow"
              onClick={() => {
                setCreateStatus("todo");
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> สร้างการ์ด
            </Button>
            )}
          </div>
        )}

        {view === "timeline" ? (
          <div className="flex-1 min-h-0 overflow-auto scroll-thin px-4 pt-3 pb-24">
            <BoardTimeline tasks={tasks} db={db} onOpen={(tid) => navigate(`/tasks/${tid}`)} />
          </div>
        ) : view === "table" ? (
          <div className="flex-1 min-h-0 overflow-auto scroll-thin px-4 pt-3 pb-24">
            <BoardTable
              tasks={tasks}
              db={db}
              me={me}
              onOpen={(tid) => navigate(`/tasks/${tid}`)}
              onMove={(tid, status) => requestMove(tid, { status, beforeId: null })}
            />
          </div>
        ) : (
          <div ref={scrollerRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden scroll-thin cursor-grab">
            <div className="h-full flex items-start gap-3 px-4 pt-3 pb-24 w-max">
              {STATUS_ORDER.map((status) => {
                const items = tasks.filter((t) => t.status === status);
                const over = drag?.over?.status === status;
                const denied = dragged && over ? moveDeniedReason(db, me, dragged, status) : null;
                const creatable = canCreate && CREATABLE_STATUSES.includes(status);
                const showPlaceholder = drag && over && !denied;
                const placeholder = showPlaceholder ? (
                  <div
                    key="__placeholder"
                    className="rounded-lg border-2 border-dashed border-primary/70 bg-primary/10 grid place-items-center text-center text-sm text-white/80"
                    style={{ height: Math.max(72, drag!.height) }}
                  >
                    <span className="flex flex-col items-center gap-1">
                      <ArrowDownToLine className="h-5 w-5 text-primary" />
                      วางการ์ดที่นี่
                      <span className="text-xs text-white/60">เพื่อย้ายงานมา {STATUS_LABEL[status]}</span>
                    </span>
                  </div>
                ) : null;
                const visible = items.filter((t) => t.id !== drag?.id);
                const before = drag?.over?.beforeId;
                const beforeIndex = before ? visible.findIndex((t) => t.id === before) : -1;

                return (
                  <section
                    key={status}
                    data-list={status}
                    aria-label={`${STATUS_LABEL[status]} ${items.length} การ์ด`}
                    className={cn(
                      "w-[17.5rem] flex-none max-h-full flex flex-col rounded-xl bg-[hsl(256_26%_10%/0.92)] border border-white/5 shadow-card",
                      denied && "ring-2 ring-red-500/60",
                    )}
                  >
                    <header className="px-3 pt-3 pb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-semibold">{STATUS_LABEL[status]}</h2>
                        <p className="text-xs text-white/55">{items.length} {STATUS_TH[status]}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/10 text-white/70" aria-label={`เมนูลิสต์ ${STATUS_LABEL[status]}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {creatable && <DropdownMenuItem onSelect={() => setComposer(status)}>เพิ่มการ์ด</DropdownMenuItem>}
                          {creatable && (
                            <DropdownMenuItem onSelect={() => { setCreateStatus(status); setCreateOpen(true); }}>สร้างการ์ดแบบละเอียด</DropdownMenuItem>
                          )}
                          {canSort && items.length > 1 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => sortList(status, "due")}>เรียงตามกำหนดส่ง</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => sortList(status, "priority")}>เรียงตาม Priority</DropdownMenuItem>
                            </>
                          )}
                          {!creatable && !(canSort && items.length > 1) && <DropdownMenuLabel className="font-normal text-muted-foreground">ไม่มีคำสั่งสำหรับลิสต์นี้</DropdownMenuLabel>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </header>

                    <div data-list-body className="flex-1 min-h-[4rem] overflow-y-auto scroll-thin px-2 pb-1 space-y-2">
                      {denied && <p className="rounded-md bg-red-500/15 px-2 py-1.5 text-xs text-red-200">{denied}</p>}
                      {visible.length === 0 && !showPlaceholder && composer !== status && (
                        creatable ? (
                          <div className="flex flex-col items-center text-center gap-1 py-6 text-white/60">
                            <Inbox className="h-10 w-10 opacity-60" strokeWidth={1.5} />
                            <p className="text-sm font-semibold text-white/80">ยังไม่มีการ์ด</p>
                            <p className="text-xs">เพิ่มงานใหม่เพื่อเริ่มวางแผน</p>
                            <Button size="sm" variant="outline" className="mt-2 border-primary/60 bg-primary/10 text-white hover:bg-primary/20" onClick={() => setComposer(status)}>
                              <Plus className="h-4 w-4" /> เพิ่มการ์ด
                            </Button>
                          </div>
                        ) : (
                          <p className="py-6 text-center text-xs text-white/50">ลากการ์ดมาวางที่นี่</p>
                        )
                      )}
                      {visible.map((task, i) => (
                        <div key={task.id} className="space-y-2">
                          {showPlaceholder && i === beforeIndex && placeholder}
                          <TaskCard
                            task={task}
                            db={db}
                            me={me}
                            canClaim={canSelfAssign && task.openForClaim}
                            onClaim={(tid) => run(() => claimTask(tid), `รับงาน ${tid} แล้ว`)}
                            onOpen={guardClick((tid) => navigate(`/tasks/${tid}`))}
                            onPointerDown={startDrag}
                          />
                        </div>
                      ))}
                      {showPlaceholder && beforeIndex === -1 && placeholder}
                      {composer === status && (
                        <Composer
                          onAdd={(title) => quickAdd(status, title)}
                          onClose={() => setComposer(null)}
                        />
                      )}
                    </div>

                    {creatable && composer !== status && visible.length > 0 && (
                      <button onClick={() => setComposer(status)} className="m-2 mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
                        <Plus className="h-4 w-4" /> เพิ่มการ์ด
                      </button>
                    )}
                    {!creatable && <div className="h-2" />}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {/* bottom dock */}
        <nav className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-2xl border border-white/10 bg-[hsl(258_34%_8%/0.92)] backdrop-blur px-2 py-1.5 shadow-elevated max-w-[calc(100%-1rem)] overflow-x-auto" aria-label="มุมมองบอร์ด">
          <DockButton icon={History} label="กิจกรรมล่าสุด" onClick={() => setActivityOpen(true)} />
          <DockButton icon={GanttChart} label="ไทม์ไลน์" active={view === "timeline"} onClick={() => setParam("view", "timeline")} />
          <DockButton icon={KanbanSquare} label="บอร์ด" active={view === "board"} onClick={() => setParam("view", null)} />
          <DockButton icon={Table2} label="ตาราง" active={view === "table"} onClick={() => setParam("view", "table")} />
          <DockButton icon={CalendarDays} label="ปฏิทิน" onClick={() => navigate(`/calendar?project=${project.id}`)} />
          <DockButton icon={BarChart3} label="สรุปรายงาน" onClick={() => navigate(`/dashboard?project=${project.id}`)} />
        </nav>

        {/* floating copy of the dragged card */}
        {drag && dragged && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.width, transform: "rotate(-3deg)" }}
          >
            <TaskCard task={dragged} db={db} me={me} ghost />
          </div>
        )}
      </div>

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} projectId={project.id} boardId={boardId === ALL ? undefined : boardId} status={createStatus} />
      <ReasonDialog
        open={!!revision}
        onOpenChange={(o) => !o && setRevision(null)}
        title={`ส่งกลับแก้ไข ${revision?.id ?? ""}`}
        description={revision ? `ย้ายจาก Review กลับไป ${STATUS_LABEL[revision.target.status]} — ผู้รับผิดชอบจะได้รับแจ้งเตือนพร้อมเหตุผล` : undefined}
        confirmLabel="ส่งกลับแก้ไข"
        onConfirm={(reason) => revision && run(() => moveTask(revision.id, revision.target.status, reason, revision.target.beforeId), "ส่งกลับแก้ไขแล้ว")}
      />
      <ReasonDialog
        open={newBoardOpen}
        onOpenChange={setNewBoardOpen}
        title="สร้าง Board ย่อย"
        label="ชื่อ Board"
        placeholder="เช่น Frontend, Backend, QA"
        confirmLabel="สร้าง Board"
        singleLine
        onConfirm={(name) => run(() => createBoard(project.id, name), `สร้าง Board "${name}" แล้ว`)}
      />
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto scroll-thin">
          <SheetHeader>
            <SheetTitle>กิจกรรมล่าสุด</SheetTitle>
            <SheetDescription>{project.name}</SheetDescription>
          </SheetHeader>
          <ol className="mt-4 space-y-3">
            {activity.map((a) => (
              <li key={`${a.taskId}-${a.id}`} className="flex gap-3">
                <UserAvatar user={db.users.find((u) => u.id === a.userId)} size="xs" />
                <button className="min-w-0 text-left text-sm hover:underline" onClick={() => { setActivityOpen(false); navigate(`/tasks/${a.taskId}`); }}>
                  <span className="font-semibold">{db.users.find((u) => u.id === a.userId)?.name ?? "ระบบ"}</span> {a.text}
                  <span className="block text-xs text-muted-foreground truncate">{a.taskId} · {a.taskTitle} · {fmtDateTime(a.createdAt)}</span>
                </button>
              </li>
            ))}
          </ol>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function HeaderButton({ children, onClick, active }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn("h-9 inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors", active ? "border-primary bg-primary/25" : "border-white/15 bg-white/5 hover:bg-white/10")}
    >
      {children}
    </button>
  );
}

function DockButton({ icon: Icon, label, active, onClick }: { icon: typeof History; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors", active ? "bg-primary/30 text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Composer({ onAdd, onClose }: { onAdd: (title: string) => boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const submit = () => {
    const title = text.trim();
    if (!title) return;
    if (onAdd(title)) {
      setText("");
      ref.current?.focus();
    }
  };
  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        placeholder="ใส่ชื่อการ์ด… (Enter เพื่อเพิ่ม)"
        className="bg-raised border-white/10 text-sm resize-none"
        aria-label="ชื่อการ์ดใหม่"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={!text.trim()}>เพิ่มการ์ด</Button>
        <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-white/10" aria-label="ยกเลิก">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FilterPopover({ filters, setFilters, members, active }: { filters: Filters; setFilters: (f: Filters) => void; members: { id: string; name: string }[]; active: number }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("h-9 inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors", active ? "border-primary bg-primary/25" : "border-white/15 bg-white/5 hover:bg-white/10")}>
          <Filter className="h-4 w-4" /> ฟิลเตอร์
          {active > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-[11px] font-bold grid place-items-center">{active}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="f-q">คำค้นหา</Label>
          <Input id="f-q" value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="รหัสงาน ชื่องาน รายละเอียด" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label>ผู้รับผิดชอบ</Label>
          <Select value={filters.assignee} onValueChange={(v) => set("assignee", v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกคน</SelectItem>
              <SelectItem value="mine">การ์ดของฉัน</SelectItem>
              <SelectItem value="unassigned">ยังไม่มอบหมาย</SelectItem>
              {members.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={filters.priority} onValueChange={(v) => set("priority", v as Filters["priority"])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>ทั้งหมด</SelectItem>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>กำหนดส่ง</Label>
            <Select value={filters.time} onValueChange={(v) => set("time", v as Filters["time"])}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>ทั้งหมด</SelectItem>
                {(["overdue", "due_soon", "on_track"] as TimeStatus[]).map((t) => <SelectItem key={t} value={t}>{TIME_STATUS_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>ป้าย</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {LABELS.map((l) => (
              <label key={l.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filters.labels.includes(l.key)}
                  onCheckedChange={(v) => set("labels", v ? [...filters.labels, l.key] : filters.labels.filter((x) => x !== l.key))}
                />
                <span className={cn("h-2 w-6 rounded-full", l.bar)} />
                {l.name}
              </label>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" disabled={!active} onClick={() => setFilters(NO_FILTERS)}>ล้างฟิลเตอร์</Button>
      </PopoverContent>
    </Popover>
  );
}

function AutomationPopover({ isAdmin }: { isAdmin: boolean }) {
  const db = useDb();
  const s = db.settings;
  const recurring = db.tasks.filter((t) => t.recurrence !== "none" && t.status !== "done").length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-medium hover:bg-white/10">
          <Zap className="h-4 w-4" /> อัตโนมัติ
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-sm">
        <h3 className="font-semibold">กฎอัตโนมัติที่ทำงานอยู่</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• แจ้งเตือนผู้รับผิดชอบก่อนครบกำหนด {s.reminderHours.join(" / ")} ชม.</li>
          <li>• งานเลยกำหนด แจ้งทันทีและเตือนซ้ำทุก {s.overdueRepeatHours} ชม.</li>
          <li>• แจ้งหัวหน้าทีมเมื่อเลยกำหนดเกิน {s.escalateAfterHours} ชม.</li>
          <li>• ส่ง Review → แจ้งผู้ตรวจรับ, ส่งกลับแก้ไข → แจ้งผู้รับผิดชอบ</li>
          <li>• งานเกิดซ้ำ {recurring} งาน สร้างรอบใหม่เมื่อปิดงาน</li>
          <li>• อีเมล{s.emailEnabled ? "เปิด" : "ปิด"}อยู่{s.workingHoursOnly ? ` (ส่งเฉพาะ ${s.workStart}–${s.workEnd})` : ""}</li>
        </ul>
        {isAdmin && (
          <Button asChild size="sm" variant="outline" className="w-full"><Link to="/admin/settings">แก้ไขกฎ</Link></Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
