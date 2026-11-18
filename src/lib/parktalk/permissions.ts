import { STAGE } from "./constants";
import type { Action, Database, Project, Task, TaskStatus, User } from "./types";

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export function isMember(project: Project | undefined, userId: string) {
  return !!project?.members.some((m) => m.userId === userId);
}

export function projectRoleOf(project: Project | undefined, userId: string) {
  return project?.members.find((m) => m.userId === userId)?.projectRole ?? null;
}

/**
 * Role permission + project scope.
 * Super Admin acts everywhere; everyone else must be a member of the project
 * (the ✓* rule in the planning document).
 */
export function can(db: Database, user: User | null, action: Action, project?: Project): boolean {
  if (!user || !user.active) return false;
  const allowed = db.settings.permissions[user.role]?.[action] ?? false;
  if (!allowed) return false;
  if (user.role === "super_admin") return true;
  if (!project) return true;
  if (action === "createProject") return true;
  return isMember(project, user.id);
}

export function canViewProject(db: Database, user: User | null, project: Project) {
  if (!user) return false;
  return can(db, user, "viewAllProjects") || isMember(project, user.id);
}

export function visibleProjects(db: Database, user: User | null) {
  return db.projects.filter((p) => canViewProject(db, user, p));
}

export function isInvolved(task: Task, userId: string) {
  return task.assigneeId === userId || task.collaboratorIds.includes(userId);
}

export function canEditTask(db: Database, user: User | null, task: Task) {
  const project = db.projects.find((p) => p.id === task.projectId);
  if (can(db, user, "editOthersTask", project)) return true;
  if (!user) return false;
  return (isInvolved(task, user.id) || task.createdBy === user.id) && can(db, user, "updateOwnTask", project);
}

export function canReview(db: Database, user: User | null, task: Task) {
  if (!user) return false;
  const project = db.projects.find((p) => p.id === task.projectId);
  if (task.reviewerId === user.id && isMember(project, user.id)) return true;
  return can(db, user, "reviewClose", project);
}

export type MoveKind = "none" | "reorder" | "move" | "approve" | "revision";

/** What a move from the task's list to `to` means in the review workflow. */
export function moveKind(task: Task, to: TaskStatus): MoveKind {
  if (task.status === to) return "reorder";
  const target = STAGE[to];
  if (task.status === "review" && target !== undefined) {
    return target > STAGE.review! ? "approve" : "revision";
  }
  return "move";
}

/** Returns null when allowed, or a reason (Thai) when the move is refused. */
export function moveDeniedReason(db: Database, user: User | null, task: Task, to: TaskStatus): string | null {
  if (!user) return "กรุณาเข้าสู่ระบบ";
  const project = db.projects.find((p) => p.id === task.projectId);
  if (!project || !canViewProject(db, user, project)) return "คุณไม่ได้อยู่ในโครงการนี้";
  const kind = moveKind(task, to);

  if (kind === "reorder") return canEditTask(db, user, task) ? null : "คุณไม่มีสิทธิ์จัดลำดับงานนี้";

  // Leaving Review is the reviewer's decision (pass → forward, fail → back with a reason).
  if (task.status === "review") {
    return canReview(db, user, task) ? null : "งานที่รอตรวจ ย้ายได้เฉพาะผู้ตรวจรับหรือหัวหน้าทีม";
  }
  if (task.status === "done") {
    return canReview(db, user, task) ? null : "งานที่ปิดแล้วเปิดใหม่ได้เฉพาะผู้ตรวจรับหรือหัวหน้าทีม";
  }
  if (to === "review" && !task.assigneeId) return "ต้องมีผู้รับผิดชอบก่อนส่งตรวจ";

  const target = STAGE[to];
  const passedReview = !task.reviewerId || !!task.approvedAt;
  if (target !== undefined && target > STAGE.review! && !passedReview) {
    return "งานที่ต้องตรวจรับต้องผ่าน Review ก่อน";
  }
  if (to === "done" && !canReview(db, user, task)) {
    return "ปิดงาน (Done) ได้เฉพาะผู้ตรวจรับหรือหัวหน้าทีม";
  }
  if (canEditTask(db, user, task)) return null;
  return "คุณไม่มีสิทธิ์ย้ายงานของผู้อื่น";
}
