import { useMemo, useState } from "react";
import { CheckSquare, Eye, MessageSquare } from "lucide-react";
import { PriorityBadge, TimeBadge } from "./Badges";
import { EmptyState } from "./EmptyState";
import { UserAvatar } from "./UserAvatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_RANK, STATUS_LABEL, STATUS_ORDER, labelOf } from "@/lib/parktalk/constants";
import { moveDeniedReason } from "@/lib/parktalk/permissions";
import { fmtDateTime, fmtShort, relativeDue, timeStatus } from "@/lib/parktalk/time";
import type { Database, Task, TaskStatus, User } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

type Sort = "list" | "due" | "priority" | "updated";

const SORTS: Record<Sort, string> = {
  list: "เรียงตามลิสต์",
  due: "กำหนดส่งใกล้สุด",
  priority: "Priority สูงสุด",
  updated: "อัปเดตล่าสุด",
};

interface Props {
  tasks: Task[];
  db: Database;
  me: User;
  onOpen: (id: string) => void;
  /** change a card's list (the board handles reasons and permissions) */
  onMove: (id: string, status: TaskStatus) => void;
}

/** Table view of the board's cards — one row per card, list changeable inline. */
export function BoardTable({ tasks, db, me, onOpen, onMove }: Props) {
  const [sort, setSort] = useState<Sort>("list");

  const rows = useMemo(() => {
    const list = [...tasks];
    if (sort === "list") list.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.order - b.order);
    if (sort === "due") list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (sort === "priority") list.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueDate.localeCompare(b.dueDate));
    if (sort === "updated") list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [tasks, sort]);

  const userOf = (id: string | null) => db.users.find((u) => u.id === id) ?? null;

  const listSelect = (t: Task, className?: string) => (
    <Select value={t.status} onValueChange={(v) => onMove(t.id, v as TaskStatus)}>
      <SelectTrigger className={cn("h-8 w-36 text-xs bg-white/5 border-white/15", className)} aria-label={`ลิสต์ของ ${t.id}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => {
          const denied = s !== t.status ? moveDeniedReason(db, me, t, s) : null;
          return (
            <SelectItem key={s} value={s} disabled={!!denied} title={denied ?? undefined}>
              {STATUS_LABEL[s]}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  return (
    <div className="rounded-xl border border-white/10 bg-[hsl(256_26%_10%/0.94)] shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="font-semibold">ตารางการ์ดงาน</h2>
          <p className="text-xs text-white/55">เปลี่ยนลิสต์ได้จากคอลัมน์ "ลิสต์" — คลิกแถวเพื่อเปิดรายละเอียด</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/55 tabular-nums">{rows.length} การ์ด</span>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-8 w-40 text-xs bg-white/5 border-white/15" aria-label="การเรียงลำดับ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORTS) as Sort[]).map((s) => <SelectItem key={s} value={s}>{SORTS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState className="m-4 bg-black/20 border-white/15 text-white/70">ไม่มีการ์ดที่ตรงกับฟิลเตอร์</EmptyState>
      ) : (
        <>
          {/* desktop / tablet */}
          <div className="hidden md:block overflow-x-auto scroll-thin">
            <table className="w-full text-left text-sm min-w-[64rem]">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/55">
                  <th className="py-2.5 px-3 w-12 text-center font-medium">ลำดับ</th>
                  <th className="py-2.5 px-3 font-medium">รหัสงาน</th>
                  <th className="py-2.5 px-3 font-medium">ชื่องาน</th>
                  <th className="py-2.5 px-3 font-medium">ลิสต์</th>
                  <th className="py-2.5 px-3 font-medium">ผู้รับผิดชอบ</th>
                  <th className="py-2.5 px-3 font-medium">Priority</th>
                  <th className="py-2.5 px-3 font-medium">กำหนดส่ง</th>
                  <th className="py-2.5 px-3 font-medium">ความคืบหน้า</th>
                  <th className="py-2.5 px-3 font-medium">อัปเดตล่าสุด</th>
                  <th className="py-2.5 px-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((t, i) => {
                  const assignee = userOf(t.assigneeId);
                  const ts = timeStatus(t, db.settings);
                  const checked = t.checklist.filter((c) => c.done).length;
                  return (
                    <tr key={t.id} onClick={() => onOpen(t.id)} className="hover:bg-white/5 cursor-pointer transition-colors">
                      <td className="py-2.5 px-3 text-center text-white/55 tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold whitespace-nowrap">{t.id}</td>
                      <td className="py-2.5 px-3 max-w-[22rem]">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {t.labels.map((k) => {
                            const l = labelOf(k);
                            return l ? <span key={k} className={cn("rounded px-1.5 text-[10px] font-semibold", l.chip)}>{l.name}</span> : null;
                          })}
                          {t.inRevision && <span className="rounded px-1.5 text-[10px] font-semibold bg-rose-500/20 text-rose-300">ต้องแก้ไข</span>}
                        </div>
                        <div className="font-medium truncate">{t.title}</div>
                        {t.description && <div className="text-xs text-white/55 truncate">{t.description}</div>}
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>{listSelect(t)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <UserAvatar user={assignee} size="xs" />
                          <span className="text-xs">{assignee?.name ?? (t.openForClaim ? "เปิดให้รับงาน" : "ยังไม่มอบหมาย")}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3"><PriorityBadge priority={t.priority} /></td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-xs">{fmtDateTime(t.dueDate)}</div>
                        {t.status !== "documents" && (
                          <TimeBadge status={ts} label={ts === "none" ? "ปิดแล้ว" : relativeDue(t.dueDate)} className="mt-1" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-white/70 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 mr-3"><CheckSquare className="h-3.5 w-3.5" />{checked}/{t.checklist.length}</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{t.comments.length}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-white/55 whitespace-nowrap">{fmtDateTime(t.updatedAt)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/10" onClick={(e) => { e.stopPropagation(); onOpen(t.id); }}>
                          <Eye className="h-3.5 w-3.5" /> ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* mobile */}
          <ul className="md:hidden divide-y divide-white/5">
            {rows.map((t, i) => {
              const assignee = userOf(t.assigneeId);
              const ts = timeStatus(t, db.settings);
              return (
                <li key={t.id} className="p-3 space-y-2">
                  <button className="w-full text-left" onClick={() => onOpen(t.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold"><span className="text-white/50 mr-1">#{i + 1}</span>{t.id}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="font-medium mt-1">{t.title}</div>
                  </button>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5"><UserAvatar user={assignee} size="xs" />{assignee?.name ?? "ยังไม่มอบหมาย"}</span>
                    {t.status !== "documents" && <TimeBadge status={ts} label={fmtShort(t.dueDate)} />}
                  </div>
                  {listSelect(t, "w-full")}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
