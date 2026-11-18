import { useEffect, useState } from "react";
import { BellRing, Building2, Clock, DatabaseZap, Play } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { AdminOnly } from "@/components/parktalk/AdminOnly";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { run } from "@/lib/parktalk/run";
import { resetDemoData, runDeadlineCheck, updateSettings, useDb } from "@/lib/parktalk/store";
import type { Settings } from "@/lib/parktalk/types";

const REMINDER_OPTIONS = [1, 4, 24, 48, 72];

export default function AdminSettings() {
  const db = useDb();
  const [form, setForm] = useState<Omit<Settings, "permissions">>(() => strip(db.settings));
  useEffect(() => setForm(strip(db.settings)), [db.settings]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(strip(db.settings));

  const save = () => {
    if (!form.emailDomain.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i)) return run(() => { throw new Error("โดเมนอีเมลไม่ถูกต้อง"); });
    if (form.workStart >= form.workEnd) return run(() => { throw new Error("เวลาเริ่มงานต้องก่อนเวลาเลิกงาน"); });
    if (form.reminderHours.length === 0) return run(() => { throw new Error("เลือกเวลาแจ้งเตือนล่วงหน้าอย่างน้อย 1 ค่า"); });
    run(() => updateSettings(form), "บันทึกการตั้งค่าแล้ว");
  };

  return (
    <AppLayout
      title="ตั้งค่าระบบ"
      subtitle="ค่าที่ใช้กับทั้ง Workspace — การเปลี่ยนแปลงถูกบันทึกใน Audit Log"
      actions={
        <>
          <Button size="sm" variant="outline" disabled={!dirty} onClick={() => setForm(strip(db.settings))}>ยกเลิก</Button>
          <Button size="sm" disabled={!dirty} onClick={save}>บันทึก</Button>
        </>
      }
    >
      <AdminOnly>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4 shadow-card">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" /> Workspace</h2>
            <div className="space-y-2">
              <Label htmlFor="s-company">ชื่อบริษัท</Label>
              <Input id="s-company" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-domain">โดเมนอีเมลบริษัท</Label>
              <Input id="s-domain" value={form.emailDomain} onChange={(e) => set("emailDomain", e.target.value.trim())} />
              <p className="text-xs text-muted-foreground">บัญชีใหม่ต้องใช้อีเมลโดเมนนี้</p>
            </div>
          </Card>

          <Card className="p-5 space-y-4 shadow-card">
            <h2 className="text-lg font-semibold flex items-center gap-2"><BellRing className="h-5 w-5" /> กฎการแจ้งเตือน</h2>
            <div className="space-y-2">
              <Label>แจ้งเตือนล่วงหน้าก่อนครบกำหนด</Label>
              <div className="flex flex-wrap gap-3">
                {REMINDER_OPTIONS.map((h) => (
                  <label key={h} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.reminderHours.includes(h)}
                      onCheckedChange={(v) => set("reminderHours", v ? [...form.reminderHours, h].sort((a, b) => a - b) : form.reminderHours.filter((x) => x !== h))}
                    />
                    {h} ชม.
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="s-repeat">เตือนซ้ำเมื่อเลยกำหนดทุก (ชม.)</Label>
                <Input id="s-repeat" type="number" min={1} value={form.overdueRepeatHours} onChange={(e) => set("overdueRepeatHours", Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-escalate">แจ้งหัวหน้าเมื่อเลยกำหนดเกิน (ชม.)</Label>
                <Input id="s-escalate" type="number" min={0} value={form.escalateAfterHours} onChange={(e) => set("escalateAfterHours", Math.max(0, Number(e.target.value) || 0))} />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>ส่งอีเมลแจ้งเตือนไปยังอีเมลบริษัท</span>
              <Switch checked={form.emailEnabled} onCheckedChange={(v) => set("emailEnabled", v)} />
            </label>
          </Card>

          <Card className="p-5 space-y-4 shadow-card">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5" /> ช่วงเวลาทำการ</h2>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>ส่งอีเมลเฉพาะในเวลาทำการ (นอกเวลาจะเข้าคิว)</span>
              <Switch checked={form.workingHoursOnly} onCheckedChange={(v) => set("workingHoursOnly", v)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="s-start">เริ่มงาน (จ.–ศ.)</Label>
                <Input id="s-start" type="time" value={form.workStart} onChange={(e) => set("workStart", e.target.value)} disabled={!form.workingHoursOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-end">เลิกงาน</Label>
                <Input id="s-end" type="time" value={form.workEnd} onChange={(e) => set("workEnd", e.target.value)} disabled={!form.workingHoursOnly} />
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4 shadow-card">
            <h2 className="text-lg font-semibold flex items-center gap-2"><DatabaseZap className="h-5 w-5" /> Deadline Monitor & ข้อมูลทดลอง</h2>
            <p className="text-sm text-muted-foreground">
              ระบบตรวจกำหนดส่งอัตโนมัติทุก 1 นาที และไม่ส่งซ้ำในเหตุการณ์เดียวกัน กดปุ่มเพื่อตรวจทันที
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => run(runDeadlineCheck, "ตรวจกำหนดส่งแล้ว")}><Play className="h-4 w-4" /> ตรวจกำหนดส่งตอนนี้</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">รีเซ็ตข้อมูลทดลอง</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>รีเซ็ตข้อมูลทั้งหมด?</AlertDialogTitle>
                    <AlertDialogDescription>โครงการ งาน บัญชี และการแจ้งเตือนทั้งหมดในเบราว์เซอร์นี้จะกลับเป็นข้อมูลตัวอย่าง ย้อนกลับไม่ได้</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { resetDemoData(); runDeadlineCheck(); }}>
                      รีเซ็ต
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        </div>
      </AdminOnly>
    </AppLayout>
  );
}

function strip(s: Settings): Omit<Settings, "permissions"> {
  const { permissions, ...rest } = s;
  return structuredClone(rest);
}
