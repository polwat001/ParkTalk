import { Lock, RotateCcw } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { AdminOnly } from "@/components/parktalk/AdminOnly";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACTIONS, ACTION_LABEL, DEFAULT_PERMISSIONS, LOCKED_SUPER_ADMIN_ACTIONS, ROLES, ROLE_LABEL } from "@/lib/parktalk/constants";
import { run } from "@/lib/parktalk/run";
import { setPermission, useDb } from "@/lib/parktalk/store";

export default function AdminPermissions() {
  const db = useDb();
  const perms = db.settings.permissions;

  const resetDefaults = () =>
    run(() => {
      ROLES.forEach((r) => ACTIONS.forEach((a) => perms[r][a] !== DEFAULT_PERMISSIONS[r][a] && setPermission(r, a, DEFAULT_PERMISSIONS[r][a])));
    }, "คืนค่าสิทธิ์เริ่มต้นแล้ว");

  return (
    <AppLayout
      title="กำหนดสิทธิ์"
      subtitle="สิทธิ์ตาม Role — ทุก Role ยกเว้น Super Admin ใช้สิทธิ์ได้เฉพาะโครงการที่ตนเป็นสมาชิก (✓*)"
      actions={<Button size="sm" variant="outline" onClick={resetDefaults}><RotateCcw className="h-4 w-4" /> คืนค่าเริ่มต้น</Button>}
    >
      <AdminOnly>
        <Card className="shadow-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">การดำเนินการ</TableHead>
                {ROLES.map((r) => <TableHead key={r} className="text-center min-w-32">{ROLE_LABEL[r]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACTIONS.map((a) => (
                <TableRow key={a}>
                  <TableCell className="font-medium">{ACTION_LABEL[a]}</TableCell>
                  {ROLES.map((r) => {
                    const locked = r === "super_admin" && LOCKED_SUPER_ADMIN_ACTIONS.includes(a);
                    const scoped = r !== "super_admin" && perms[r][a] && a !== "createProject";
                    return (
                      <TableCell key={r} className="text-center">
                        <span className="inline-flex items-center gap-1">
                          <Checkbox
                            checked={perms[r][a]}
                            disabled={locked}
                            onCheckedChange={(v) => run(() => setPermission(r, a, v === true))}
                            aria-label={`${ROLE_LABEL[r]} · ${ACTION_LABEL[a]}`}
                          />
                          {locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="ล็อกไว้" />}
                          {scoped && <span className="text-xs text-muted-foreground">*</span>}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
          <li>* ใช้ได้เฉพาะในโครงการที่เป็นสมาชิก — บทบาทในโครงการ (Manager / Leader) กำหนดที่หน้าโครงการ</li>
          <li>ผู้ใช้ไม่สามารถปรับ Role ของตนเองได้ และสิทธิ์ที่มีรูปกุญแจของ Super Admin ปิดไม่ได้</li>
          <li>ผู้ตรวจรับที่ระบุใน Task ตรวจรับงานนั้นได้เสมอ แม้ Role จะไม่มีสิทธิ์ "ตรวจรับและปิดงาน"</li>
          <li>ทุกการเปลี่ยนแปลงสิทธิ์ถูกบันทึกใน Audit Log</li>
        </ul>
      </AdminOnly>
    </AppLayout>
  );
}
