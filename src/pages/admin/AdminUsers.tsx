import { useEffect, useMemo, useState } from "react";
import { KeyRound, Search, UserPlus } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { AdminOnly } from "@/components/parktalk/AdminOnly";
import { ReasonDialog } from "@/components/parktalk/ReasonDialog";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLES, ROLE_LABEL } from "@/lib/parktalk/constants";
import { run } from "@/lib/parktalk/run";
import { createUser, resetPassword, setUserActive, updateUser, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { fmtDate } from "@/lib/parktalk/time";
import type { Role } from "@/lib/parktalk/types";

export default function AdminUsers() {
  const db = useDb();
  const me = useCurrentUser();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);

  const users = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.users.filter((u) => !q || `${u.name} ${u.email} ${u.department}`.toLowerCase().includes(q));
  }, [db.users, search]);

  return (
    <AppLayout
      title="บัญชีผู้ใช้"
      subtitle={`บัญชีบริษัทผูกกับอีเมล @${db.settings.emailDomain} — ปิดบัญชีแล้วประวัติงานยังคงอยู่`}
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ อีเมล แผนก..." className="pl-9 h-9 bg-card w-60" />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" /> สร้างบัญชี</Button>
        </>
      }
    >
      <AdminOnly>
        <Card className="shadow-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>พนักงาน</TableHead>
                <TableHead>แผนก</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>โครงการ</TableHead>
                <TableHead>สร้างเมื่อ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">รหัสผ่าน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const self = u.id === me?.id;
                return (
                  <TableRow key={u.id} className={u.active ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={u} />
                        <div className="min-w-0">
                          <div className="font-medium">{u.name}{self && <span className="text-xs text-muted-foreground"> (คุณ)</span>}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{u.department || "—"}</TableCell>
                    <TableCell>
                      <Select value={u.role} disabled={self} onValueChange={(v) => run(() => updateUser(u.id, { role: v as Role }), `เปลี่ยน Role ของ ${u.name} แล้ว`)}>
                        <SelectTrigger className="h-8 w-40 text-xs" title={self ? "ไม่สามารถปรับ Role ของตนเองได้" : undefined}><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{db.projects.filter((p) => p.members.some((m) => m.userId === u.id)).length}</TableCell>
                    <TableCell className="text-sm">{fmtDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={u.active} disabled={self} onCheckedChange={(v) => run(() => setUserActive(u.id, v), v ? "เปิดบัญชีแล้ว" : "ปิดบัญชีแล้ว")} aria-label={`สถานะบัญชี ${u.name}`} />
                        {u.active ? "ใช้งาน" : "ปิดแล้ว"}
                      </label>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setResetFor(u.id)}><KeyRound className="h-4 w-4" /> ตั้งใหม่</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </AdminOnly>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ReasonDialog
        open={!!resetFor}
        onOpenChange={(o) => !o && setResetFor(null)}
        title={`ตั้งรหัสผ่านใหม่ · ${db.users.find((u) => u.id === resetFor)?.name ?? ""}`}
        label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
        confirmLabel="บันทึกรหัสผ่าน"
        singleLine
        onConfirm={(pw) => run(() => resetFor && resetPassword(resetFor, pw), "ตั้งรหัสผ่านใหม่แล้ว")}
      />
    </AppLayout>
  );
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useDb();
  const [form, setForm] = useState({ name: "", email: "", role: "developer" as Role, department: "", password: "" });
  useEffect(() => {
    if (open) setForm({ name: "", email: "", role: "developer", department: "", password: "" });
  }, [open]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (run(() => createUser(form), `สร้างบัญชี ${form.email} แล้ว — ส่งอีเมลต้อนรับแล้ว`)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างบัญชีพนักงาน</DialogTitle>
          <DialogDescription>ต้องใช้อีเมลบริษัท @{db.settings.emailDomain} — ระบบจะส่งอีเมลแจ้งผู้ใช้</DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u-name">ชื่อ-นามสกุล *</Label>
            <Input id="u-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-email">อีเมลบริษัท *</Label>
            <Input id="u-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={`name@${db.settings.emailDomain}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-dept">แผนก</Label>
              <Input id="u-dept" value={form.department} onChange={(e) => set("department", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-pw">รหัสผ่านเริ่มต้น * (อย่างน้อย 8 ตัวอักษร)</Label>
            <Input id="u-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button type="submit" form="user-form" disabled={!form.name.trim() || !form.email.trim() || form.password.length < 8}>สร้างบัญชี</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
