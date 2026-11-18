import { format } from "date-fns";
import { th } from "date-fns/locale";
import { UNTIMED_STATUSES } from "./constants";
import type { Settings, Task, TimeStatus } from "./types";

export const HOUR = 3600_000;

/** Time status is kept separate from the work status (planning doc MOD-03). */
export function timeStatus(task: Task, settings: Settings, now = Date.now()): TimeStatus {
  if (UNTIMED_STATUSES.includes(task.status)) return "none";
  const due = new Date(task.dueDate).getTime();
  if (now > due) return "overdue";
  const window = Math.max(24, ...settings.reminderHours) * HOUR;
  if (due - now <= window) return "due_soon";
  return "on_track";
}

export function fmtDate(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy", { locale: th });
}

/** "18 ก.พ." — compact date for card chips */
export function fmtShort(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "d MMM", { locale: th });
}

export function fmtDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy HH:mm", { locale: th });
}

export function relativeDue(dueIso: string, now = Date.now()) {
  const diff = new Date(dueIso).getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / HOUR);
  const text = hours < 1 ? "ไม่ถึง 1 ชม." : hours < 48 ? `${hours} ชม.` : `${Math.round(hours / 24)} วัน`;
  return diff >= 0 ? `เหลือ ${text}` : `เลยกำหนด ${text}`;
}

/** "yyyy-MM-ddTHH:mm" for <input type="datetime-local"> */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function isWithinWorkingHours(settings: Settings, now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  const [sh, sm] = settings.workStart.split(":").map(Number);
  const [eh, em] = settings.workEnd.split(":").map(Number);
  return minutes >= sh * 60 + sm && minutes < eh * 60 + em;
}
