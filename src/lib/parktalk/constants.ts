import type { Action, Priority, Role, TaskStatus, TimeStatus, Recurrence } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  project_manager: "Project Manager",
  team_leader: "Team Leader",
  developer: "Developer",
};

export const ROLES: Role[] = ["super_admin", "project_manager", "team_leader", "developer"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  testing: "Testing",
  deploy: "Deploy",
  done: "Done",
  standby: "Standby",
  documents: "Documents",
};

/** Column subtitle: "{n} …" */
export const STATUS_TH: Record<TaskStatus, string> = {
  open: "งานรอคัดกรอง",
  todo: "งานรอเริ่ม",
  in_progress: "งานกำลังดำเนินการ",
  review: "งานรอตรวจสอบ",
  testing: "งานทดสอบระบบ",
  deploy: "งานรอขึ้นระบบ",
  done: "งานเสร็จสิ้น",
  standby: "งานรอความพร้อม",
  documents: "เอกสาร / คู่มือ",
};

export const STATUS_ORDER: TaskStatus[] = [
  "open",
  "todo",
  "in_progress",
  "review",
  "testing",
  "deploy",
  "done",
  "standby",
  "documents",
];

/** Position in the delivery flow; side lists (Standby, Documents) are outside it. */
export const STAGE: Partial<Record<TaskStatus, number>> = {
  open: 0,
  todo: 1,
  in_progress: 2,
  review: 3,
  testing: 4,
  deploy: 5,
  done: 6,
};

/** Lists a new card may start in (later lists must be reached through Review). */
export const CREATABLE_STATUSES: TaskStatus[] = ["open", "todo", "in_progress", "standby", "documents"];

/** Lists the deadline monitor ignores. */
export const UNTIMED_STATUSES: TaskStatus[] = ["done", "documents"];

export const LABELS: { key: string; name: string; bar: string; chip: string }[] = [
  { key: "frontend", name: "Frontend", bar: "bg-sky-400", chip: "bg-sky-400/15 text-sky-300" },
  { key: "backend", name: "Backend", bar: "bg-emerald-400", chip: "bg-emerald-400/15 text-emerald-300" },
  { key: "uiux", name: "UI/UX", bar: "bg-fuchsia-400", chip: "bg-fuchsia-400/15 text-fuchsia-300" },
  { key: "qa", name: "QA / Test", bar: "bg-amber-400", chip: "bg-amber-400/15 text-amber-300" },
  { key: "devops", name: "DevOps", bar: "bg-violet-400", chip: "bg-violet-400/15 text-violet-300" },
  { key: "bug", name: "Bug", bar: "bg-rose-500", chip: "bg-rose-500/15 text-rose-300" },
  { key: "docs", name: "Docs", bar: "bg-slate-300", chip: "bg-slate-300/15 text-slate-200" },
];

export const labelOf = (key: string) => LABELS.find((l) => l.key === key);

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

export const TIME_STATUS_LABEL: Record<TimeStatus, string> = {
  on_track: "On Track",
  due_soon: "Due Soon",
  overdue: "Overdue",
  none: "—",
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "ไม่เกิดซ้ำ",
  daily: "ทุกวัน",
  weekly: "ทุกสัปดาห์",
  monthly: "ทุกเดือน",
};

export const ACTION_LABEL: Record<Action, string> = {
  manageUsers: "จัดการบัญชีบริษัท",
  createProject: "สร้าง Project",
  createBoard: "สร้าง Board",
  inviteMember: "เชิญสมาชิก",
  createTask: "สร้าง Task",
  editOthersTask: "แก้งานผู้อื่น",
  assignTask: "มอบหมาย/โยกย้าย",
  selfAssign: "รับงานด้วยตนเอง",
  updateOwnTask: "อัปเดตงานที่รับ",
  changeDueDate: "เปลี่ยน Due Date",
  reviewClose: "ตรวจรับและปิดงาน",
  viewAllProjects: "ดูทุก Project",
};

export const ACTIONS: Action[] = Object.keys(ACTION_LABEL) as Action[];

/** Default matrix from the planning document, section 5. */
export const DEFAULT_PERMISSIONS: Record<Role, Record<Action, boolean>> = {
  super_admin: Object.fromEntries(ACTIONS.map((a) => [a, true])) as Record<Action, boolean>,
  project_manager: {
    manageUsers: false,
    createProject: true,
    createBoard: true,
    inviteMember: true,
    createTask: true,
    editOthersTask: true,
    assignTask: true,
    selfAssign: true,
    updateOwnTask: true,
    changeDueDate: true,
    reviewClose: true,
    viewAllProjects: false,
  },
  team_leader: {
    manageUsers: false,
    createProject: false,
    createBoard: true,
    inviteMember: true,
    createTask: true,
    editOthersTask: true,
    assignTask: true,
    selfAssign: true,
    updateOwnTask: true,
    changeDueDate: true,
    reviewClose: true,
    viewAllProjects: false,
  },
  developer: {
    manageUsers: false,
    createProject: false,
    createBoard: false,
    inviteMember: false,
    createTask: true,
    editOthersTask: false,
    assignTask: false,
    selfAssign: true,
    updateOwnTask: true,
    changeDueDate: false,
    reviewClose: false,
    viewAllProjects: false,
  },
};

/** Actions that can never be removed from Super Admin (prevents lock-out). */
export const LOCKED_SUPER_ADMIN_ACTIONS: Action[] = ["manageUsers", "viewAllProjects"];
