import { AlertTriangle, CheckCircle2, CheckSquare, Clock, Flame, GripVertical, Hand, MessageSquare, Paperclip, RotateCcw } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { labelOf } from "@/lib/parktalk/constants";
import { fmtShort, relativeDue, timeStatus } from "@/lib/parktalk/time";
import type { Database, Task, User } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;

interface Props {
  task: Task;
  db: Database;
  me: User;
  canClaim?: boolean;
  showProject?: boolean;
  spacious?: boolean;
  /** rendered as the floating copy under the pointer */
  ghost?: boolean;
  onOpen?: (id: string) => void;
  onClaim?: (id: string) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>, task: Task) => void;
}

export function TaskCard({ task, db, me, canClaim, showProject, spacious, ghost, onOpen, onClaim, onPointerDown }: Props) {
  const assignee = db.users.find((u) => u.id === task.assigneeId) ?? null;
  const ts = timeStatus(task, db.settings);
  const done = task.status === "done";
  const checked = task.checklist.filter((c) => c.done).length;
  const cover = task.attachments.find((a) => IMAGE_RE.test(a.url));
  const project = showProject ? db.projects.find((p) => p.id === task.projectId) : null;
  const mine = task.assigneeId === me.id;

  const dueTone =
    done ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : ts === "overdue" ? "bg-red-500/20 text-red-300 border-red-500/40"
    : ts === "due_soon" ? "bg-amber-400/20 text-amber-200 border-amber-400/40"
    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";

  return (
    <article
      data-card={task.id}
      tabIndex={ghost ? -1 : 0}
      role={ghost ? undefined : "button"}
      aria-label={ghost ? undefined : `${task.id} ${task.title}`}
      onPointerDown={(e) => onPointerDown?.(e, task)}
      onClick={() => onOpen?.(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(task.id);
        }
      }}
      className={cn(
        "group rounded-lg bg-raised border border-white/5 shadow-card overflow-hidden select-none",
        "hover:border-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        onPointerDown ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        mine && !ghost && "border-l-2 border-l-secondary/70",
        ghost && "shadow-elevated ring-2 ring-primary/70",
      )}
    >
      {cover && (
        <div className="p-2 pb-0">
          <img src={cover.url} alt="" className="w-full h-20 object-cover rounded-md bg-white" loading="lazy" draggable={false} />
        </div>
      )}
      <div className={cn("relative px-2 py-2.5 space-y-1.5", spacious && "px-4 py-4 space-y-2")}>
        {ghost && <GripVertical className="absolute -left-0.5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" aria-hidden />}
        {(task.labels.length > 0 || task.inRevision) && (
          <div className="flex flex-wrap items-center gap-1">
            {task.labels.map((k) => {
              const l = labelOf(k);
              return l ? <span key={k} className={cn("h-1.5 w-9 rounded-full", l.bar)} title={l.name} /> : null;
            })}
            {task.inRevision && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 text-[10px] font-semibold bg-rose-500/20 text-rose-300">
                <RotateCcw className="h-3 w-3" /> ต้องแก้ไข
              </span>
            )}
          </div>
        )}
        {project && <div className={cn("text-[11px] text-muted-foreground truncate", spacious && "text-sm")}>{project.name}</div>}
        <h3 className={cn("text-[13px] font-semibold leading-snug flex gap-1.5", spacious && "text-base leading-snug", ghost && "pl-3")}>
          {done && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
          {(task.priority === "critical" || task.priority === "high") && !done && (
            <Flame className={cn("h-4 w-4 shrink-0 mt-0.5", task.priority === "critical" ? "text-red-400" : "text-orange-400")} aria-label={`Priority ${task.priority}`} />
          )}
          <span className={cn("min-w-0", spacious && "break-words")}>{task.title}</span>
        </h3>
        {task.description && <p className={cn("text-[11px] leading-snug text-muted-foreground line-clamp-2", spacious && "text-sm", ghost && "pl-3")}>{task.description}</p>}

        <div className={cn("flex items-end gap-1.5 pt-1 text-[10.5px] text-muted-foreground whitespace-nowrap", spacious && "text-xs", ghost && "pl-3")}>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
          {task.status !== "documents" && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-md border px-1 py-px font-medium", dueTone)} title={done ? "ปิดงานแล้ว" : relativeDue(task.dueDate)}>
              {ts === "overdue" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {fmtShort(task.dueDate)}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span className={cn("inline-flex items-center gap-1", checked === task.checklist.length && "text-emerald-400")} title="Checklist">
              <CheckSquare className="h-3 w-3" />
              {checked}/{task.checklist.length}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="inline-flex items-center gap-1" title="ความคิดเห็น">
              <MessageSquare className="h-3 w-3" />
              {task.comments.length}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1" title="ไฟล์แนบ">
              <Paperclip className="h-3 w-3" />
              {task.attachments.length}
            </span>
          )}
          </span>
          <span className="ml-auto shrink-0 flex items-center gap-1.5">
            {canClaim && onClaim && !assignee ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onClaim(task.id);
                }}
                className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 font-semibold hover:bg-emerald-500/30"
                title="รับงานนี้"
              >
                <Hand className="h-3 w-3" /> รับ
              </button>
            ) : (
              (assignee || task.status !== "documents") && <UserAvatar user={assignee} size="xs" className="h-5 w-5 text-[9px]" />
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
