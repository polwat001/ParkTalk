import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock, AlertTriangle, AtSign, Bell, CheckCheck, CheckCircle2, Hand, Mail, RotateCcw, Send, UserCheck, CalendarClock } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/parktalk/permissions";
import { markAllRead, markRead, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { fmtDateTime } from "@/lib/parktalk/time";
import type { EmailMessage, NotificationType } from "@/lib/parktalk/types";
import { cn } from "@/lib/utils";

const ICON: Record<NotificationType, { icon: typeof Bell; tone: string }> = {
  assigned: { icon: UserCheck, tone: "bg-sky-500/20 text-sky-300" },
  reassigned: { icon: UserCheck, tone: "bg-sky-500/20 text-sky-300" },
  due_changed: { icon: CalendarClock, tone: "bg-slate-500/20 text-slate-300" },
  due_soon: { icon: AlarmClock, tone: "bg-amber-500/20 text-amber-300" },
  overdue: { icon: AlertTriangle, tone: "bg-red-500/20 text-red-300" },
  overdue_escalation: { icon: AlertTriangle, tone: "bg-red-500/20 text-red-300" },
  review_requested: { icon: Send, tone: "bg-violet-500/20 text-violet-300" },
  revision: { icon: RotateCcw, tone: "bg-rose-500/20 text-rose-300" },
  approved: { icon: CheckCircle2, tone: "bg-emerald-500/20 text-emerald-300" },
  mention: { icon: AtSign, tone: "bg-cyan-500/20 text-cyan-300" },
  claimed: { icon: Hand, tone: "bg-emerald-500/20 text-emerald-300" },
};

export default function Notifications() {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openEmail, setOpenEmail] = useState<string | null>(null);

  const isAdmin = can(db, me, "manageUsers");
  const items = useMemo(() => db.notifications.filter((n) => n.userId === me?.id && (!unreadOnly || !n.read)), [db, me, unreadOnly]);
  const emails = useMemo(() => db.emails.filter((e) => isAdmin || e.toUserId === me?.id).slice(0, 200), [db, me, isAdmin]);
  if (!me) return null;
  const unread = db.notifications.filter((n) => n.userId === me.id && !n.read).length;

  return (
    <AppLayout
      title="การแจ้งเตือน"
      subtitle="ระบบตรวจกำหนดส่งทุก 1 นาที และส่งแจ้งเตือนทั้งในระบบและอีเมลบริษัท"
      actions={
        <Button size="sm" variant="outline" disabled={!unread} onClick={() => markAllRead(me.id)}>
          <CheckCheck className="h-4 w-4" /> อ่านทั้งหมด
        </Button>
      }
    >
      <Tabs defaultValue="inapp">
        <TabsList>
          <TabsTrigger value="inapp"><Bell className="h-3.5 w-3.5 mr-1" />ในระบบ ({unread} ยังไม่อ่าน)</TabsTrigger>
          <TabsTrigger value="email"><Mail className="h-3.5 w-3.5 mr-1" />อีเมล{isAdmin ? " (ทั้งบริษัท)" : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="inapp" className="space-y-3 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} /> แสดงเฉพาะที่ยังไม่อ่าน
          </label>
          {items.length === 0 ? (
            <EmptyState>ไม่มีการแจ้งเตือน</EmptyState>
          ) : (
            <Card className="divide-y shadow-card overflow-hidden">
              {items.map((n) => {
                const { icon: Icon, tone } = ICON[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      if (n.taskId && db.tasks.some((t) => t.id === n.taskId)) navigate(`/tasks/${n.taskId}`);
                    }}
                    className={cn("w-full flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors", !n.read && "bg-secondary/5")}
                  >
                    <span className={cn("h-9 w-9 rounded-full grid place-items-center shrink-0", tone)}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                      <span className="block text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{n.body}</span>
                      <span className="block text-xs text-muted-foreground mt-1">{fmtDateTime(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-secondary mt-1.5 shrink-0" aria-label="ยังไม่อ่าน" />}
                  </button>
                );
              })}
            </Card>
          )}
        </TabsContent>
        <TabsContent value="email" className="space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">
            {db.settings.emailEnabled ? "อีเมลถูกส่งไปยังอีเมลบริษัทของผู้รับ" : "ปิดการส่งอีเมลอยู่ (ตั้งค่าระบบ)"} · ในรุ่นทดลองนี้แสดงเป็นกล่องจดหมายออก ยังไม่ได้ต่อ SMTP จริง
          </p>
          {emails.length === 0 ? (
            <EmptyState>ยังไม่มีอีเมลแจ้งเตือน</EmptyState>
          ) : (
            <Card className="divide-y shadow-card overflow-hidden">
              {emails.map((e) => <EmailRow key={e.id} email={e} open={openEmail === e.id} onToggle={() => setOpenEmail((x) => (x === e.id ? null : e.id))} />)}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function EmailRow({ email, open, onToggle }: { email: EmailMessage; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40" aria-expanded={open}>
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium truncate">{email.subject}</span>
          <span className="block text-xs text-muted-foreground truncate">ถึง {email.to}</span>
        </span>
        <span className={cn("text-xs rounded-full px-2 py-0.5 shrink-0", email.status === "sent" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>
          {email.status === "sent" ? "ส่งแล้ว" : "รอเวลาทำการ"}
        </span>
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{fmtDateTime(email.createdAt)}</span>
      </button>
      {open && <pre className="mx-3 mb-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm font-sans">{email.body}</pre>}
    </div>
  );
}
