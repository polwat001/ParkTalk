/**
 * ParkTalk data store (frontend mock).
 *
 * Everything lives in localStorage so all screens read one task source.
 * Every action re-checks permissions here, the way a real API would; when a
 * backend is added, these functions become the API calls and the checks move
 * server-side.
 */
import { useSyncExternalStore } from "react";
import { CREATABLE_STATUSES, LOCKED_SUPER_ADMIN_ACTIONS, STAGE, STATUS_LABEL, UNTIMED_STATUSES } from "./constants";
import {
  PermissionError,
  can,
  canEditTask,
  canReview,
  isInvolved,
  isMember,
  moveDeniedReason,
  moveKind,
} from "./permissions";
import { createSeed } from "./seed";
import { HOUR, fmtDateTime, isWithinWorkingHours } from "./time";
import type {
  Action,
  AuditLog,
  Database,
  NotificationType,
  Priority,
  Project,
  ProjectMember,
  Recurrence,
  Role,
  Settings,
  Task,
  TaskStatus,
  User,
} from "./types";

const DB_KEY = "parktalk_db_v3";
const SESSION_KEY = "parktalk_session";

// ─── persistence ────────────────────────────────────────────────────────────
function load(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === 3) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return createSeed();
}

let db: Database = load();
let sessionUserId: string | null = readSession();
const listeners = new Set<() => void>();

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function save(data = db, requirePersistence = false) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch {
    if (requirePersistence) throw new Error("บันทึกรูปโปรไฟล์ไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์");
    /* storage full or blocked — keep in memory */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keep tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DB_KEY) {
      db = load();
      emit();
    }
    if (e.key === SESSION_KEY) {
      sessionUserId = readSession();
      emit();
    }
  });
}

function commit<T>(mutator: (d: Database) => T, requirePersistence = false): T {
  const next = structuredClone(db);
  const result = mutator(next);
  save(next, requirePersistence);
  db = next;
  emit();
  return result;
}

export function getDb() {
  return db;
}

export function useDb() {
  return useSyncExternalStore(subscribe, () => db);
}

export function useCurrentUser(): User | null {
  const d = useDb();
  const id = useSyncExternalStore(subscribe, () => sessionUserId);
  return d.users.find((u) => u.id === id && u.active) ?? null;
}

export function resetDemoData() {
  db = createSeed();
  save();
  emit();
}

// ─── helpers ────────────────────────────────────────────────────────────────
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

function actor(d: Database): User {
  const u = d.users.find((x) => x.id === sessionUserId && x.active);
  if (!u) throw new PermissionError("กรุณาเข้าสู่ระบบ");
  return u;
}

function requirePerm(d: Database, user: User, action: Action, project?: Project) {
  if (!can(d, user, action, project)) {
    throw new PermissionError("คุณไม่มีสิทธิ์ทำรายการนี้");
  }
}

function findTask(d: Database, id: string) {
  const t = d.tasks.find((x) => x.id === id);
  if (!t) throw new Error("ไม่พบงาน");
  return t;
}

function findProject(d: Database, id: string) {
  const p = d.projects.find((x) => x.id === id);
  if (!p) throw new Error("ไม่พบโครงการ");
  return p;
}

function nameOf(d: Database, userId: string | null) {
  if (!userId) return "ไม่มี";
  return d.users.find((u) => u.id === userId)?.name ?? userId;
}

function audit(
  d: Database,
  userId: string | null,
  action: string,
  entity: AuditLog["entity"],
  entityId: string,
  detail: string,
) {
  d.auditLogs.unshift({ id: uid("L"), userId, action, entity, entityId, detail, createdAt: nowIso() });
  if (d.auditLogs.length > 2000) d.auditLogs.length = 2000;
}

function activity(task: Task, userId: string, text: string) {
  task.activity.unshift({ id: uid("A"), userId, text, createdAt: nowIso() });
  task.updatedAt = nowIso();
}

/**
 * In-app + email notification. `dedupKey` stops the same event being sent twice
 * (planning doc: ป้องกัน Email ซ้ำในเหตุการณ์เดียวกัน).
 */
function notify(
  d: Database,
  userId: string | null | undefined,
  type: NotificationType,
  title: string,
  body: string,
  taskId: string | null,
  dedupKey?: string,
) {
  if (!userId) return;
  const user = d.users.find((u) => u.id === userId);
  if (!user || !user.active) return;
  if (dedupKey) {
    const key = `${dedupKey}:${userId}`;
    if (d.sentKeys.includes(key)) return;
    d.sentKeys.push(key);
    if (d.sentKeys.length > 5000) d.sentKeys.splice(0, d.sentKeys.length - 5000);
  }
  const createdAt = nowIso();
  d.notifications.unshift({ id: uid("N"), userId, type, title, body, taskId, createdAt, read: false });
  if (d.settings.emailEnabled) {
    const inHours = !d.settings.workingHoursOnly || isWithinWorkingHours(d.settings);
    d.emails.unshift({
      id: uid("E"),
      to: user.email,
      toUserId: user.id,
      subject: `[ParkTalk] ${title}`,
      body: `เรียน ${user.name}\n\n${body}${taskId ? `\n\nเปิดงาน: /tasks/${taskId}` : ""}\n\n— ParkTalk`,
      createdAt,
      status: inHours ? "sent" : "queued",
      sentAt: inHours ? createdAt : null,
    });
  }
}

function leadersOf(project: Project) {
  return project.members.filter((m) => m.projectRole !== "member").map((m) => m.userId);
}

// ─── auth ───────────────────────────────────────────────────────────────────
export function login(email: string, password: string): User {
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  if (!user.active) throw new Error("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
  sessionUserId = user.id;
  localStorage.setItem(SESSION_KEY, user.id);
  commit((d) => audit(d, user.id, "login", "user", user.id, "เข้าสู่ระบบ"));
  return user;
}

export function logout() {
  sessionUserId = null;
  localStorage.removeItem(SESSION_KEY);
  emit();
}

// ─── tasks ──────────────────────────────────────────────────────────────────
export interface TaskInput {
  projectId: string;
  boardId: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  startDate?: string | null;
  assigneeId?: string | null;
  collaboratorIds?: string[];
  reviewerId?: string | null;
  openForClaim?: boolean;
  recurrence?: Recurrence;
  /** list to start in; defaults to To Do when assigned, otherwise Open */
  status?: TaskStatus;
  labels?: string[];
}

/** Appends to the end of a list unless `beforeId` names the card to sit above. */
function placeInList(d: Database, task: Task, beforeId: string | null | undefined) {
  const siblings = d.tasks
    .filter((t) => t.projectId === task.projectId && t.status === task.status && t.id !== task.id)
    .sort((a, b) => a.order - b.order);
  const at = beforeId ? siblings.findIndex((t) => t.id === beforeId) : -1;
  siblings.splice(at === -1 ? siblings.length : at, 0, task);
  siblings.forEach((t, i) => (t.order = i));
}

export function createTask(input: TaskInput): Task {
  return commit((d) => {
    const user = actor(d);
    const project = findProject(d, input.projectId);
    requirePerm(d, user, "createTask", project);
    if (!input.title.trim()) throw new Error("กรุณาระบุชื่องาน");
    if (!input.dueDate) throw new Error("กรุณาระบุ Due Date");
    if (input.assigneeId && input.assigneeId !== user.id) requirePerm(d, user, "assignTask", project);
    if (!project.boards.some((b) => b.id === input.boardId)) throw new Error("ไม่พบ Board");
    const status = input.status ?? (input.assigneeId ? "todo" : "open");
    if (!CREATABLE_STATUSES.includes(status)) throw new Error(`สร้างการ์ดใหม่ใน ${STATUS_LABEL[status]} ไม่ได้ — งานต้องผ่าน Review ก่อน`);

    d.counters[project.id] = (d.counters[project.id] ?? 0) + 1;
    const id = `${project.key}-${d.counters[project.id]}`;
    const now = nowIso();
    const task: Task = {
      id,
      projectId: project.id,
      boardId: input.boardId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status,
      assigneeId: input.assigneeId ?? null,
      collaboratorIds: input.collaboratorIds ?? [],
      reviewerId: input.reviewerId ?? null,
      openForClaim: !input.assigneeId && !!input.openForClaim,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate,
      recurrence: input.recurrence ?? "none",
      labels: input.labels ?? [],
      order: 0,
      approvedAt: null,
      inRevision: false,
      checklist: [],
      attachments: [],
      comments: [],
      activity: [],
      revisionCount: 0,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    activity(task, user.id, `สร้างการ์ดใน ${STATUS_LABEL[status]}`);
    d.tasks.push(task);
    placeInList(d, task, null);
    audit(d, user.id, "create", "task", id, `สร้างงาน "${task.title}"`);
    if (task.assigneeId && task.assigneeId !== user.id) {
      notify(d, task.assigneeId, "assigned", `ได้รับมอบหมายงาน ${id}`, `${user.name} มอบหมายงาน "${task.title}" ให้คุณ\nกำหนดส่ง: ${fmtDateTime(task.dueDate)}`, id, `assigned:${id}:${task.assigneeId}:${now}`);
    }
    task.collaboratorIds.forEach((c) =>
      notify(d, c, "assigned", `ถูกเพิ่มเป็นผู้ร่วมงาน ${id}`, `${user.name} เพิ่มคุณเป็นผู้ร่วมงานใน "${task.title}"`, id),
    );
    return task;
  });
}

export type TaskPatch = Partial<
  Pick<Task, "title" | "description" | "priority" | "boardId" | "reviewerId" | "collaboratorIds" | "startDate" | "openForClaim" | "recurrence" | "labels">
>;

export function updateTask(id: string, patch: TaskPatch) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    if (!canEditTask(d, user, task)) throw new PermissionError("คุณไม่มีสิทธิ์แก้ไขงานนี้");
    const project = findProject(d, task.projectId);
    if (("reviewerId" in patch || "collaboratorIds" in patch) && !can(d, user, "assignTask", project)) {
      throw new PermissionError("เปลี่ยนผู้ตรวจรับ/ผู้ร่วมงานได้เฉพาะผู้มีสิทธิ์มอบหมายงาน");
    }
    const changes: string[] = [];
    (Object.keys(patch) as (keyof TaskPatch)[]).forEach((k) => {
      if (JSON.stringify(task[k]) !== JSON.stringify(patch[k])) changes.push(k);
    });
    if (!changes.length) return;
    const addedCollaborators = (patch.collaboratorIds ?? []).filter((c) => !task.collaboratorIds.includes(c));
    Object.assign(task, patch);
    if (task.title.trim() === "") throw new Error("กรุณาระบุชื่องาน");
    activity(task, user.id, `แก้ไข ${changes.join(", ")}`);
    audit(d, user.id, "update", "task", id, `แก้ไข ${changes.join(", ")}`);
    addedCollaborators.forEach((c) =>
      notify(d, c, "assigned", `ถูกเพิ่มเป็นผู้ร่วมงาน ${id}`, `${user.name} เพิ่มคุณเป็นผู้ร่วมงานใน "${task.title}"`, id),
    );
  });
}

export function deleteTask(id: string) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    const project = findProject(d, task.projectId);
    if (!can(d, user, "editOthersTask", project) && task.createdBy !== user.id) {
      throw new PermissionError("คุณไม่มีสิทธิ์ลบงานนี้");
    }
    d.tasks = d.tasks.filter((t) => t.id !== id);
    audit(d, user.id, "delete", "task", id, `ลบงาน "${task.title}"`);
  });
}

/** Push: a leader assigns or reassigns, with a reason; old and new assignee are told. */
export function assignTask(id: string, assigneeId: string | null, reason: string) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    const project = findProject(d, task.projectId);
    requirePerm(d, user, "assignTask", project);
    if (assigneeId && !isMember(project, assigneeId)) throw new Error("ผู้รับงานต้องเป็นสมาชิกของโครงการ");
    const previous = task.assigneeId;
    if (previous === assigneeId) return;
    if (previous && !reason.trim()) throw new Error("กรุณาระบุเหตุผลในการโยกย้ายงาน");
    task.assigneeId = assigneeId;
    task.openForClaim = false;
    if (assigneeId && task.status === "open") {
      task.status = "todo";
      placeInList(d, task, null);
    }
    const text = previous
      ? `โยกย้ายงานจาก ${nameOf(d, previous)} → ${nameOf(d, assigneeId)}${reason ? ` (เหตุผล: ${reason})` : ""}`
      : `มอบหมายงานให้ ${nameOf(d, assigneeId)}`;
    activity(task, user.id, text);
    audit(d, user.id, previous ? "reassign" : "assign", "task", id, text);
    const stamp = nowIso();
    if (assigneeId) {
      notify(d, assigneeId, previous ? "reassigned" : "assigned", `ได้รับมอบหมายงาน ${id}`, `${user.name} มอบหมายงาน "${task.title}" ให้คุณ\nกำหนดส่ง: ${fmtDateTime(task.dueDate)}${reason ? `\nเหตุผล: ${reason}` : ""}`, id, `assigned:${id}:${assigneeId}:${stamp}`);
    }
    if (previous) {
      notify(d, previous, "reassigned", `งาน ${id} ถูกโยกย้าย`, `${user.name} โยกย้ายงาน "${task.title}" ไปให้ ${nameOf(d, assigneeId)}${reason ? `\nเหตุผล: ${reason}` : ""}`, id, `unassigned:${id}:${previous}:${stamp}`);
    }
  });
}

/** Pull: a member claims a task that is open for claiming. */
export function claimTask(id: string) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    const project = findProject(d, task.projectId);
    requirePerm(d, user, "selfAssign", project);
    if (task.assigneeId) throw new Error("งานนี้มีผู้รับผิดชอบแล้ว");
    if (!task.openForClaim) throw new Error("งานนี้ไม่ได้เปิดให้รับเอง");
    task.assigneeId = user.id;
    task.openForClaim = false;
    if (task.status === "open") {
      task.status = "todo";
      placeInList(d, task, null);
    }
    activity(task, user.id, "รับงานด้วยตนเอง");
    audit(d, user.id, "claim", "task", id, `${user.name} รับงานด้วยตนเอง`);
    leadersOf(project).forEach((l) =>
      l !== user.id && notify(d, l, "claimed", `${user.name} รับงาน ${id}`, `"${task.title}" ถูกรับโดย ${user.name}`, id),
    );
  });
}

export function changeDueDate(id: string, dueDate: string, reason: string) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    const project = findProject(d, task.projectId);
    requirePerm(d, user, "changeDueDate", project);
    if (!dueDate) throw new Error("กรุณาระบุ Due Date");
    if (task.dueDate === dueDate) return;
    if (!reason.trim()) throw new Error("กรุณาระบุเหตุผลในการเปลี่ยนกำหนดส่ง");
    const text = `เปลี่ยนกำหนดส่ง ${fmtDateTime(task.dueDate)} → ${fmtDateTime(dueDate)} (เหตุผล: ${reason})`;
    task.dueDate = dueDate;
    activity(task, user.id, text);
    audit(d, user.id, "change_due", "task", id, text);
    [task.assigneeId, ...task.collaboratorIds].forEach((u) =>
      u && u !== user.id && notify(d, u, "due_changed", `เปลี่ยนกำหนดส่งงาน ${id}`, `${user.name} ${text}`, id, `due:${id}:${dueDate}`),
    );
  });
}

/**
 * Moves a card to a list (and position). Leaving Review forward = approve;
 * leaving Review backward = send back for revision, which needs a reason.
 */
export function moveTask(id: string, to: TaskStatus, reason = "", beforeId: string | null = null) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    const denied = moveDeniedReason(d, user, task, to);
    if (denied) throw new PermissionError(denied);
    const from = task.status;
    const kind = moveKind(task, to);
    if (kind === "reorder") {
      placeInList(d, task, beforeId);
      task.updatedAt = nowIso();
      return;
    }
    if (kind === "revision" && !reason.trim()) throw new Error("กรุณาระบุเหตุผลที่ส่งกลับแก้ไข");

    task.status = to;
    placeInList(d, task, beforeId);
    if (to === "in_progress" && !task.startDate) task.startDate = nowIso();
    if (to === "done") task.completedAt = nowIso();
    if (from === "done") task.completedAt = null;
    if (to === "review") task.inRevision = false;
    if (kind === "approve") task.approvedAt = nowIso();
    if (kind === "revision") {
      task.revisionCount += 1;
      task.inRevision = true;
      task.approvedAt = null;
    }
    // Going back before Review (e.g. reopened from Testing) means it must be reviewed again.
    if (kind === "move" && STAGE[to] !== undefined && STAGE[to]! < STAGE.review!) task.approvedAt = null;

    const verb = kind === "approve" ? "ผ่านการตรวจ" : kind === "revision" ? "ส่งกลับแก้ไข" : "ย้าย";
    const text = `${verb} ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}${reason ? ` (เหตุผล: ${reason})` : ""}`;
    activity(task, user.id, text);
    audit(d, user.id, kind === "move" ? "move" : kind, "task", id, text);
    const stamp = nowIso();

    if (to === "review") {
      const project = findProject(d, task.projectId);
      const reviewers = task.reviewerId ? [task.reviewerId] : leadersOf(project);
      reviewers.forEach((r) =>
        r !== user.id && notify(d, r, "review_requested", `งาน ${id} รอตรวจรับ`, `${nameOf(d, task.assigneeId)} ส่งงาน "${task.title}" ให้ตรวจรับ`, id, `review:${id}:${stamp}`),
      );
    }
    if (kind === "revision") {
      notify(d, task.assigneeId, "revision", `งาน ${id} ถูกส่งกลับแก้ไข`, `${user.name} ส่งงาน "${task.title}" กลับแก้ไข\nเหตุผล: ${reason}`, id, `revision:${id}:${stamp}`);
    }
    if (kind === "approve" && task.assigneeId !== user.id) {
      notify(d, task.assigneeId, "approved", `งาน ${id} ผ่านการตรวจรับ`, `${user.name} ตรวจรับงาน "${task.title}" แล้ว → ${STATUS_LABEL[to]}`, id, `approved:${id}:${stamp}`);
    }
    if (to === "done") {
      if (kind !== "approve" && task.assigneeId && task.assigneeId !== user.id) {
        notify(d, task.assigneeId, "approved", `งาน ${id} ปิดงานแล้ว`, `${user.name} ปิดงาน "${task.title}" แล้ว`, id, `done:${id}:${stamp}`);
      }
      spawnRecurrence(d, task, user);
    }
  });
}

/** Rewrites the order of a whole list (column "sort" menu). */
export function reorderList(ids: string[]) {
  commit((d) => {
    const user = actor(d);
    ids.forEach((id, i) => {
      const t = findTask(d, id);
      if (!canEditTask(d, user, t) && !can(d, user, "assignTask", findProject(d, t.projectId))) {
        throw new PermissionError("คุณไม่มีสิทธิ์จัดลำดับรายการนี้");
      }
      t.order = i;
    });
  });
}

function spawnRecurrence(d: Database, task: Task, user: User) {
  if (task.recurrence === "none") return;
  const project = findProject(d, task.projectId);
  const due = new Date(task.dueDate);
  if (task.recurrence === "daily") due.setDate(due.getDate() + 1);
  if (task.recurrence === "weekly") due.setDate(due.getDate() + 7);
  if (task.recurrence === "monthly") due.setMonth(due.getMonth() + 1);
  d.counters[project.id] = (d.counters[project.id] ?? 0) + 1;
  const id = `${project.key}-${d.counters[project.id]}`;
  const now = nowIso();
  const next: Task = {
    ...structuredClone(task),
    id,
    status: task.assigneeId ? "todo" : "open",
    dueDate: due.toISOString(),
    approvedAt: null,
    inRevision: false,
    startDate: null,
    checklist: task.checklist.map((c) => ({ ...c, done: false })),
    comments: [],
    attachments: [],
    activity: [],
    revisionCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  activity(next, user.id, `สร้างอัตโนมัติจากงานเกิดซ้ำ ${task.id}`);
  d.tasks.push(next);
  placeInList(d, next, null);
  audit(d, user.id, "create", "task", id, `สร้างงานเกิดซ้ำจาก ${task.id}`);
  notify(d, next.assigneeId, "assigned", `งานเกิดซ้ำ ${id}`, `"${next.title}" รอบใหม่ กำหนดส่ง ${fmtDateTime(next.dueDate)}`, id);
}

// checklist / attachments / comments ────────────────────────────────────────
function editable(d: Database, id: string) {
  const user = actor(d);
  const task = findTask(d, id);
  if (!canEditTask(d, user, task)) throw new PermissionError("คุณไม่มีสิทธิ์แก้ไขงานนี้");
  return { user, task };
}

export function addChecklistItem(id: string, text: string) {
  commit((d) => {
    const { user, task } = editable(d, id);
    if (!text.trim()) throw new Error("กรุณาระบุรายการ");
    task.checklist.push({ id: uid("C"), text: text.trim(), done: false });
    activity(task, user.id, `เพิ่ม checklist "${text.trim()}"`);
  });
}

export function toggleChecklistItem(id: string, itemId: string) {
  commit((d) => {
    const { user, task } = editable(d, id);
    const item = task.checklist.find((c) => c.id === itemId);
    if (!item) return;
    item.done = !item.done;
    activity(task, user.id, `${item.done ? "ทำเสร็จ" : "ยกเลิก"} checklist "${item.text}"`);
  });
}

export function removeChecklistItem(id: string, itemId: string) {
  commit((d) => {
    const { user, task } = editable(d, id);
    const item = task.checklist.find((c) => c.id === itemId);
    task.checklist = task.checklist.filter((c) => c.id !== itemId);
    if (item) activity(task, user.id, `ลบ checklist "${item.text}"`);
  });
}

export function addAttachment(id: string, name: string, url: string) {
  commit((d) => {
    const { user, task } = editable(d, id);
    if (!/^https?:\/\//i.test(url.trim())) throw new Error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
    task.attachments.push({ id: uid("F"), name: name.trim() || url.trim(), url: url.trim(), addedBy: user.id, addedAt: nowIso() });
    activity(task, user.id, `แนบลิงก์ "${name.trim() || url.trim()}"`);
  });
}

export function removeAttachment(id: string, attachmentId: string) {
  commit((d) => {
    const { user, task } = editable(d, id);
    task.attachments = task.attachments.filter((a) => a.id !== attachmentId);
    activity(task, user.id, "ลบไฟล์แนบ");
  });
}

export function addComment(id: string, body: string) {
  commit((d) => {
    const user = actor(d);
    const task = findTask(d, id);
    const project = findProject(d, task.projectId);
    if (!isMember(project, user.id) && !can(d, user, "viewAllProjects")) {
      throw new PermissionError("คุณไม่ได้อยู่ในโครงการนี้");
    }
    if (!body.trim()) throw new Error("กรุณาพิมพ์ความคิดเห็น");
    const comment = { id: uid("M"), userId: user.id, body: body.trim(), createdAt: nowIso() };
    task.comments.push(comment);
    activity(task, user.id, "แสดงความคิดเห็น");
    // @mentions — members whose "@Full Name" appears in the comment
    project.members
      .map((m) => d.users.find((u) => u.id === m.userId))
      .filter((u): u is User => !!u && u.id !== user.id && body.includes(`@${u.name}`))
      .forEach((u) =>
        notify(d, u.id, "mention", `${user.name} กล่าวถึงคุณใน ${id}`, `"${body.trim()}"`, id, `mention:${comment.id}`),
      );
  });
}

// ─── projects ───────────────────────────────────────────────────────────────
export interface ProjectInput {
  name: string;
  key: string;
  description: string;
  ownerId: string;
  startDate: string;
  endDate: string;
}

export function createProject(input: ProjectInput): Project {
  return commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "createProject");
    const key = input.key.trim().toUpperCase();
    if (!input.name.trim()) throw new Error("กรุณาระบุชื่อโครงการ");
    if (!/^[A-Z]{2,5}$/.test(key)) throw new Error("รหัสโครงการต้องเป็นตัวอักษรภาษาอังกฤษ 2–5 ตัว");
    if (d.projects.some((p) => p.key === key)) throw new Error("รหัสโครงการนี้ถูกใช้แล้ว");
    if (input.endDate && input.startDate && input.endDate < input.startDate) throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
    const id = uid("P");
    const members: ProjectMember[] = [{ userId: input.ownerId, projectRole: "manager" }];
    if (input.ownerId !== user.id && user.role !== "super_admin") members.push({ userId: user.id, projectRole: "manager" });
    const project: Project = {
      id,
      key,
      name: input.name.trim(),
      description: input.description.trim(),
      ownerId: input.ownerId,
      startDate: input.startDate,
      endDate: input.endDate,
      members,
      boards: [{ id: uid("B"), name: "Main" }],
      archived: false,
      createdAt: nowIso(),
    };
    d.projects.push(project);
    d.counters[id] = 0;
    audit(d, user.id, "create", "project", id, `สร้างโครงการ "${project.name}"`);
    return project;
  });
}

export function updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "ownerId" | "startDate" | "endDate" | "archived">>) {
  commit((d) => {
    const user = actor(d);
    const project = findProject(d, id);
    if (!(can(d, user, "createProject", project) && (user.role === "super_admin" || isMember(project, user.id)))) {
      throw new PermissionError("คุณไม่มีสิทธิ์แก้ไขโครงการนี้");
    }
    Object.assign(project, patch);
    audit(d, user.id, "update", "project", id, `แก้ไขโครงการ (${Object.keys(patch).join(", ")})`);
  });
}

export function addMember(projectId: string, userId: string, projectRole: ProjectMember["projectRole"]) {
  commit((d) => {
    const user = actor(d);
    const project = findProject(d, projectId);
    requirePerm(d, user, "inviteMember", project);
    if (projectRole !== "member" && !can(d, user, "createProject", project)) {
      throw new PermissionError("แต่งตั้ง Manager/Leader ได้เฉพาะ Project Manager ขึ้นไป");
    }
    if (isMember(project, userId)) throw new Error("ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว");
    project.members.push({ userId, projectRole });
    audit(d, user.id, "add_member", "project", projectId, `เพิ่ม ${nameOf(d, userId)} (${projectRole})`);
  });
}

export function setMemberRole(projectId: string, userId: string, projectRole: ProjectMember["projectRole"]) {
  commit((d) => {
    const user = actor(d);
    const project = findProject(d, projectId);
    if (!can(d, user, "createProject", project)) throw new PermissionError("คุณไม่มีสิทธิ์เปลี่ยนบทบาทในโครงการ");
    if (userId === user.id && user.role !== "super_admin") throw new PermissionError("ไม่สามารถปรับบทบาทของตนเองได้");
    const m = project.members.find((x) => x.userId === userId);
    if (!m) return;
    m.projectRole = projectRole;
    audit(d, user.id, "member_role", "project", projectId, `${nameOf(d, userId)} → ${projectRole}`);
  });
}

export function removeMember(projectId: string, userId: string) {
  commit((d) => {
    const user = actor(d);
    const project = findProject(d, projectId);
    requirePerm(d, user, "inviteMember", project);
    if (userId === project.ownerId) throw new Error("ไม่สามารถถอดเจ้าของโครงการได้");
    const target = project.members.find((m) => m.userId === userId);
    if (target && target.projectRole !== "member" && !can(d, user, "createProject", project)) {
      throw new PermissionError("ถอด Manager/Leader ได้เฉพาะ Project Manager ขึ้นไป");
    }
    project.members = project.members.filter((m) => m.userId !== userId);
    // Unassign open tasks so nothing is left with someone outside the project.
    d.tasks
      .filter((t) => t.projectId === projectId && t.status !== "done")
      .forEach((t) => {
        if (t.assigneeId === userId) {
          t.assigneeId = null;
          t.status = t.status === "todo" ? "open" : t.status;
          activity(t, user.id, `ถอด ${nameOf(d, userId)} ออกจากโครงการ — งานไม่มีผู้รับผิดชอบ`);
        }
        t.collaboratorIds = t.collaboratorIds.filter((c) => c !== userId);
      });
    audit(d, user.id, "remove_member", "project", projectId, `ถอด ${nameOf(d, userId)}`);
  });
}

export function createBoard(projectId: string, name: string) {
  commit((d) => {
    const user = actor(d);
    const project = findProject(d, projectId);
    requirePerm(d, user, "createBoard", project);
    if (!name.trim()) throw new Error("กรุณาระบุชื่อ Board");
    project.boards.push({ id: uid("B"), name: name.trim() });
    audit(d, user.id, "create_board", "project", projectId, `สร้าง Board "${name.trim()}"`);
  });
}

export function deleteBoard(projectId: string, boardId: string) {
  commit((d) => {
    const user = actor(d);
    const project = findProject(d, projectId);
    requirePerm(d, user, "createBoard", project);
    if (d.tasks.some((t) => t.boardId === boardId)) throw new Error("ย้ายหรือลบงานใน Board นี้ก่อน");
    if (project.boards.length <= 1) throw new Error("โครงการต้องมีอย่างน้อย 1 Board");
    project.boards = project.boards.filter((b) => b.id !== boardId);
    audit(d, user.id, "delete_board", "project", projectId, "ลบ Board");
  });
}

// ─── users ──────────────────────────────────────────────────────────────────
export interface UserInput {
  name: string;
  email: string;
  role: Role;
  department: string;
  password: string;
}

export function createUser(input: UserInput) {
  commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "manageUsers");
    const email = input.email.trim().toLowerCase();
    if (!input.name.trim()) throw new Error("กรุณาระบุชื่อ");
    if (!email.endsWith(`@${d.settings.emailDomain}`)) throw new Error(`ต้องใช้อีเมลบริษัท (@${d.settings.emailDomain})`);
    if (d.users.some((u) => u.email.toLowerCase() === email)) throw new Error("อีเมลนี้มีบัญชีอยู่แล้ว");
    if (input.password.length < 8) throw new Error("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    const id = uid("U");
    d.users.push({ id, name: input.name.trim(), email, role: input.role, department: input.department.trim(), password: input.password, active: true, createdAt: nowIso() });
    audit(d, user.id, "create", "user", id, `สร้างบัญชี ${email} (${input.role})`);
    notify(d, id, "assigned", "ยินดีต้อนรับสู่ ParkTalk", `บัญชีของคุณถูกสร้างโดย ${user.name}\nเข้าสู่ระบบด้วยอีเมล ${email}`, null);
  });
}

export function updateProfile(name: string, department: string) {
  commit((d) => {
    const user = actor(d);
    const trimmedName = name.trim();
    const trimmedDepartment = department.trim();
    if (!trimmedName) throw new Error("กรุณาระบุชื่อ");
    if (user.name === trimmedName && user.department === trimmedDepartment) return;
    user.name = trimmedName;
    user.department = trimmedDepartment;
    audit(d, user.id, "update", "user", user.id, "แก้ไขข้อมูลโปรไฟล์");
  });
}

export function updateProfileAvatar(expectedUserId: string, avatarUrl: string | null) {
  commit((d) => {
    const user = actor(d);
    if (user.id !== expectedUserId) throw new PermissionError("บัญชีเปลี่ยนระหว่างแก้ไขโปรไฟล์ กรุณาลองอีกครั้ง");
    if (avatarUrl !== null && (avatarUrl.length > 200_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(avatarUrl))) {
      throw new Error("รูปโปรไฟล์ไม่ถูกต้องหรือมีขนาดใหญ่เกินไป");
    }
    if (avatarUrl === null) delete user.avatarUrl;
    else user.avatarUrl = avatarUrl;
    audit(d, user.id, "update", "user", user.id, avatarUrl ? "เปลี่ยนรูปโปรไฟล์" : "ลบรูปโปรไฟล์");
  }, true);
}

export function changePassword(currentPassword: string, newPassword: string) {
  commit((d) => {
    const user = actor(d);
    if (user.password !== currentPassword) throw new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
    if (newPassword.length < 8) throw new Error("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    user.password = newPassword;
    audit(d, user.id, "change_password", "user", user.id, "เปลี่ยนรหัสผ่านของตนเอง");
  });
}

export function updateUser(id: string, patch: Partial<Pick<User, "name" | "role" | "department">>) {
  commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "manageUsers");
    if (id === user.id && patch.role && patch.role !== user.role) throw new PermissionError("ไม่สามารถปรับ Role ของตนเองได้");
    const target = d.users.find((u) => u.id === id);
    if (!target) throw new Error("ไม่พบผู้ใช้");
    Object.assign(target, patch);
    audit(d, user.id, "update", "user", id, `แก้ไขบัญชี ${target.email} (${Object.keys(patch).join(", ")})`);
  });
}

export function setUserActive(id: string, active: boolean) {
  commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "manageUsers");
    if (id === user.id) throw new PermissionError("ไม่สามารถปิดบัญชีของตนเองได้");
    const target = d.users.find((u) => u.id === id);
    if (!target) throw new Error("ไม่พบผู้ใช้");
    target.active = active;
    audit(d, user.id, active ? "activate" : "deactivate", "user", id, `${active ? "เปิด" : "ปิด"}บัญชี ${target.email} (ประวัติงานยังคงอยู่)`);
  });
}

export function resetPassword(id: string, password: string) {
  commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "manageUsers");
    if (password.length < 8) throw new Error("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    const target = d.users.find((u) => u.id === id);
    if (!target) throw new Error("ไม่พบผู้ใช้");
    target.password = password;
    audit(d, user.id, "reset_password", "user", id, `ตั้งรหัสผ่านใหม่ให้ ${target.email}`);
  });
}

// ─── settings ───────────────────────────────────────────────────────────────
export function updateSettings(patch: Partial<Omit<Settings, "permissions">>) {
  commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "manageUsers");
    Object.assign(d.settings, patch);
    audit(d, user.id, "update", "settings", "settings", `แก้ไขการตั้งค่า (${Object.keys(patch).join(", ")})`);
  });
}

export function setPermission(role: Role, action: Action, value: boolean) {
  commit((d) => {
    const user = actor(d);
    requirePerm(d, user, "manageUsers");
    if (role === "super_admin" && LOCKED_SUPER_ADMIN_ACTIONS.includes(action) && !value) {
      throw new PermissionError("สิทธิ์นี้ของ Super Admin ปิดไม่ได้");
    }
    d.settings.permissions[role][action] = value;
    audit(d, user.id, "permission", "settings", `${role}.${action}`, `${role} · ${action} = ${value ? "อนุญาต" : "ไม่อนุญาต"}`);
  });
}

// ─── notifications ──────────────────────────────────────────────────────────
export function markRead(id: string) {
  commit((d) => {
    const n = d.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}

export function markAllRead(userId: string) {
  commit((d) => d.notifications.forEach((n) => n.userId === userId && (n.read = true)));
}

// ─── deadline monitor ───────────────────────────────────────────────────────
/**
 * Checks every open task for due-soon / overdue and escalates to leaders.
 * Pure on the passed database so it can be unit-tested; dedup keys make it
 * safe to run as often as you like. Runs regardless of who is logged in.
 */
export function runDeadlineCheckOn(d: Database, now = Date.now()) {
  const s = d.settings;
  for (const task of d.tasks) {
    if (UNTIMED_STATUSES.includes(task.status) || !task.assigneeId) continue;
    const due = new Date(task.dueDate).getTime();
    const left = due - now;
    if (left > 0) {
      const hits = [...s.reminderHours].sort((a, b) => a - b).filter((h) => left <= h * HOUR);
      if (hits.length) {
        const h = hits[0];
        notify(d, task.assigneeId, "due_soon", `งาน ${task.id} ใกล้ครบกำหนด`, `"${task.title}" ครบกำหนด ${fmtDateTime(task.dueDate)} (ภายใน ${h} ชม.)`, task.id, `due_soon:${task.id}:${task.dueDate}:${h}`);
      }
      continue;
    }
    const overdueMs = now - due;
    const bucket = Math.floor(overdueMs / (Math.max(1, s.overdueRepeatHours) * HOUR));
    notify(d, task.assigneeId, "overdue", `งาน ${task.id} เลยกำหนดส่ง`, `"${task.title}" เลยกำหนด ${fmtDateTime(task.dueDate)} แล้ว กรุณาอัปเดตความคืบหน้า`, task.id, `overdue:${task.id}:${task.dueDate}:${bucket}`);
    if (overdueMs >= s.escalateAfterHours * HOUR) {
      const project = d.projects.find((p) => p.id === task.projectId);
      if (project) {
        leadersOf(project).forEach((l) =>
          notify(d, l, "overdue_escalation", `งาน ${task.id} เลยกำหนดเกิน ${s.escalateAfterHours} ชม.`, `"${task.title}" ของ ${nameOf(d, task.assigneeId)} เลยกำหนด ${fmtDateTime(task.dueDate)}`, task.id, `escalate:${task.id}:${task.dueDate}`),
        );
      }
    }
  }
  // Flush emails held outside working hours.
  if (!s.workingHoursOnly || isWithinWorkingHours(s, now)) {
    const ts = new Date(now).toISOString();
    d.emails.forEach((e) => {
      if (e.status === "queued") {
        e.status = "sent";
        e.sentAt = ts;
      }
    });
  }
}

export function runDeadlineCheck() {
  const before = JSON.stringify([db.notifications.length, db.emails.map((e) => e.status)]);
  const next = structuredClone(db);
  runDeadlineCheckOn(next);
  if (JSON.stringify([next.notifications.length, next.emails.map((e) => e.status)]) !== before) {
    db = next;
    save();
    emit();
  }
}

export { isInvolved, canReview };
