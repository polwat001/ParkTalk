export type Role = "super_admin" | "project_manager" | "team_leader" | "developer";

export type TaskStatus =
  | "open"
  | "todo"
  | "in_progress"
  | "review"
  | "testing"
  | "deploy"
  | "done"
  | "standby"
  | "documents";
export type Priority = "critical" | "high" | "medium" | "low";
export type TimeStatus = "on_track" | "due_soon" | "overdue" | "none";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type Action =
  | "manageUsers"
  | "createProject"
  | "createBoard"
  | "inviteMember"
  | "createTask"
  | "editOthersTask"
  | "assignTask"
  | "selfAssign"
  | "updateOwnTask"
  | "changeDueDate"
  | "reviewClose"
  | "viewAllProjects";

export interface User {
  id: string;
  name: string;
  email: string; // company email — used for login and email alerts
  password: string; // mock only — a real backend stores a hash
  role: Role;
  department: string;
  avatarUrl?: string;
  active: boolean;
  createdAt: string;
}

export interface ProjectMember {
  userId: string;
  projectRole: "manager" | "leader" | "member";
}

export interface Board {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  key: string; // prefix for task ids, e.g. "PT"
  name: string;
  description: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  members: ProjectMember[];
  boards: Board[];
  archived: boolean;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  addedBy: string;
  addedAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string; // e.g. "PT-12"
  projectId: string;
  boardId: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  assigneeId: string | null;
  collaboratorIds: string[];
  reviewerId: string | null;
  openForClaim: boolean; // pull: members may self-assign
  startDate: string | null;
  dueDate: string; // ISO datetime
  recurrence: Recurrence;
  labels: string[];
  order: number; // position inside its list
  approvedAt: string | null; // set when the reviewer passes the Review step
  inRevision: boolean; // sent back from Review, not yet re-submitted
  checklist: ChecklistItem[];
  attachments: Attachment[];
  comments: Comment[];
  activity: Activity[];
  revisionCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type NotificationType =
  | "assigned"
  | "reassigned"
  | "due_changed"
  | "due_soon"
  | "overdue"
  | "overdue_escalation"
  | "review_requested"
  | "revision"
  | "approved"
  | "mention"
  | "claimed";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId: string | null;
  createdAt: string;
  read: boolean;
}

export interface EmailMessage {
  id: string;
  to: string;
  toUserId: string;
  subject: string;
  body: string;
  createdAt: string;
  status: "sent" | "queued";
  sentAt: string | null;
}

export interface AuditLog {
  id: string;
  userId: string | null; // null = system (deadline monitor)
  action: string;
  entity: "task" | "project" | "user" | "settings";
  entityId: string;
  detail: string;
  createdAt: string;
}

export interface Settings {
  companyName: string;
  emailDomain: string;
  reminderHours: number[]; // e.g. [24, 48]
  overdueRepeatHours: number; // re-notify overdue every N hours
  escalateAfterHours: number; // notify leaders when overdue longer than this
  emailEnabled: boolean;
  workingHoursOnly: boolean; // queue emails outside working hours
  workStart: string; // "09:00"
  workEnd: string; // "18:00"
  permissions: Record<Role, Record<Action, boolean>>;
}

export interface Database {
  version: number;
  users: User[];
  projects: Project[];
  tasks: Task[];
  notifications: AppNotification[];
  emails: EmailMessage[];
  auditLogs: AuditLog[];
  settings: Settings;
  sentKeys: string[]; // dedup keys for notifications / emails
  counters: Record<string, number>; // per-project task numbering
}
