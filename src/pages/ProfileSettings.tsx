import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import AppLayout from "@/components/parktalk/AppLayout";
import { UserAvatar } from "@/components/parktalk/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/lib/parktalk/constants";
import { run } from "@/lib/parktalk/run";
import { changePassword, updateProfile, updateProfileAvatar, useCurrentUser } from "@/lib/parktalk/store";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_SIZE = 192;

async function prepareAvatar(file: File) {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("กรุณาเลือกไฟล์ JPG, PNG หรือ WebP");
  if (file.size > MAX_AVATAR_FILE_SIZE) throw new Error("ไฟล์รูปต้องมีขนาดไม่เกิน 5 MB");

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("เปิดไฟล์รูปไม่ได้ กรุณาเลือกไฟล์ใหม่");
    });

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("เบราว์เซอร์ไม่สามารถปรับขนาดรูปได้");

    const { naturalWidth: width, naturalHeight: height } = image;
    const side = Math.min(width, height);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ProfileSettings() {
  const user = useCurrentUser();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  if (!user) return null;
  const userId = user.id;

  async function saveAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setSavingAvatar(true);
    try {
      const avatarUrl = await prepareAvatar(file);
      run(() => updateProfileAvatar(userId, avatarUrl), "บันทึกรูปโปรไฟล์แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดรูปโปรไฟล์ไม่ได้");
    } finally {
      setSavingAvatar(false);
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    run(() => updateProfile(String(values.get("name")), String(values.get("department"))), "บันทึกโปรไฟล์แล้ว");
  }

  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("newPassword"));
    const saved = run(() => {
      if (password !== values.get("confirmPassword")) throw new Error("รหัสผ่านใหม่กับรหัสผ่านยืนยันไม่ตรงกัน");
      changePassword(String(values.get("currentPassword")), password);
    }, "เปลี่ยนรหัสผ่านแล้ว");
    if (saved) form.reset();
  }

  return (
    <AppLayout title="ตั้งค่าโปรไฟล์" contentClassName="max-w-5xl px-4 sm:px-6">
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card className="space-y-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">ข้อมูลบัญชี</h2>
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="md" className="h-16 w-16 text-lg" />
            <div className="min-w-0">
              <p className="break-words font-medium">{user.name}</p>
              <p className="break-words text-sm text-muted-foreground">{user.email} · {ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <div className="space-y-2">
            <input ref={avatarInput} type="file" accept={AVATAR_TYPES.join(",")} onChange={saveAvatar} hidden />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={savingAvatar} aria-describedby="profile-avatar-hint" onClick={() => avatarInput.current?.click()}>
                {savingAvatar ? "กำลังบันทึกรูป..." : user.avatarUrl ? "เปลี่ยนรูปโปรไฟล์" : "อัปโหลดรูปโปรไฟล์"}
              </Button>
              {user.avatarUrl && (
                <Button type="button" variant="ghost" disabled={savingAvatar} onClick={() => run(() => updateProfileAvatar(userId, null), "ลบรูปโปรไฟล์แล้ว")}>
                  ลบรูปโปรไฟล์
                </Button>
              )}
            </div>
            <p id="profile-avatar-hint" className="text-sm text-muted-foreground">JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</p>
          </div>
          <form key={JSON.stringify([user.id, user.name, user.department])} onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">ชื่อที่แสดง</Label>
              <Input id="profile-name" name="name" autoComplete="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-department">แผนก</Label>
              <Input id="profile-department" name="department" defaultValue={user.department} />
            </div>
            <Button type="submit">บันทึกโปรไฟล์</Button>
          </form>
        </Card>

        <Card className="space-y-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h2>
          <form key={user.id} onSubmit={savePassword} className="space-y-4">
            <input type="hidden" name="username" autoComplete="username" value={user.email} />
            <div className="space-y-2">
              <Label htmlFor="profile-current-password">รหัสผ่านปัจจุบัน</Label>
              <Input id="profile-current-password" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">รหัสผ่านใหม่</Label>
              <Input id="profile-new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} aria-describedby="profile-password-hint" required />
              <p id="profile-password-hint" className="text-sm text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-password">ยืนยันรหัสผ่านใหม่</Label>
              <Input id="profile-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required />
            </div>
            <Button type="submit">เปลี่ยนรหัสผ่าน</Button>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
