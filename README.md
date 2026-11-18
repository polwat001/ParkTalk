# ParkTalk

ระบบวางแผนและมอบหมายงานภายในบริษัทสำหรับทีม Development (แนวคิด Kanban คล้าย Trello)
พัฒนาต่อจากแนวทาง Technician Board / Dispatch / Notification ของระบบ FixFlow เดิม
ตามเอกสาร `ParkTalk_System_Planning_v1` — รุ่นนี้ครอบคลุม Phase 1 และบางส่วนของ Phase 2

## เริ่มใช้งาน

```sh
npm install
npm run dev        # https://localhost:8080
npm test
```

บัญชีทดลอง (ข้อมูลจำลอง) อยู่ใน `src/lib/parktalk/seed.ts` — กดเลือกได้จากหน้า Login

## หน้าจอ

| Route | หน้าที่ |
|---|---|
| `/login` | เข้าสู่ระบบด้วยอีเมลบริษัท |
| `/dashboard` | ภาพรวม, อัตราส่งตรงเวลา, เวลาปิดงานเฉลี่ย, แก้ไขซ้ำ, Export CSV |
| `/my-tasks` | งานของฉัน แยกเลยกำหนด / ใกล้ครบ / รอตรวจ, งานที่เปิดให้รับ |
| `/projects` | โครงการ, สมาชิก, บทบาทในโครงการ, Board |
| `/projects/:id/board` | บอร์ด 9 ลิสต์ (Open → To Do → In Progress → Review → Testing → Deploy → Done + Standby, Documents), ลากการ์ดข้ามลิสต์และจัดลำดับในลิสต์, เพิ่มการ์ดในลิสต์, ฟิลเตอร์, ไทม์ไลน์, กิจกรรมล่าสุด |
| `/tasks/:id` | รายละเอียด, มอบหมาย/โยกย้ายพร้อมเหตุผล, เปลี่ยน Due Date, Review, Checklist, ลิงก์แนบ, ความคิดเห็น + @mention, Activity Log |
| `/team/workload` | ภาระงานของสมาชิก |
| `/calendar` | ปฏิทิน เดือน/สัปดาห์/วัน, กดวันเพื่อสร้างงาน |
| `/notifications` | แจ้งเตือนในระบบ + กล่องอีเมลออก |
| `/admin/users` `/admin/permissions` `/admin/settings` `/admin/audit-logs` | สำหรับ Super Admin |

## กฎของบอร์ด

- การ์ดที่มี Reviewer ต้องผ่าน **Review** ก่อนเข้า Testing / Deploy / Done
- ลากการ์ดออกจาก Review ไปข้างหน้า = ผ่านการตรวจ, ลากย้อนกลับ = ส่งกลับแก้ไข (ต้องใส่เหตุผล)
- Done ปิดได้เฉพาะผู้ตรวจรับหรือหัวหน้าทีม
- สร้างการ์ดใหม่ได้ใน Open, To Do, In Progress, Standby, Documents
- Documents ไม่ถูกนับกำหนดส่ง

## โครงสร้าง

- `src/lib/parktalk/store.ts` — แหล่งข้อมูลเดียวของทุกหน้าจอ (localStorage), ตรวจสิทธิ์ทุก action, Audit Log, แจ้งเตือน + อีเมลแบบกันส่งซ้ำ, Deadline Monitor
- `src/lib/parktalk/permissions.ts` — Role & Permission Matrix และกฎการย้ายสถานะ
- `src/components/parktalk/` — Layout, การ์ดงาน, ฟอร์ม, Badge

## ข้อจำกัดของรุ่นนี้ (frontend + mock)

- ข้อมูลเก็บใน localStorage ของเบราว์เซอร์ ยังไม่มี backend / ฐานข้อมูลกลาง
- อีเมลแสดงเป็นกล่องจดหมายออกในระบบ ยังไม่ส่งผ่าน SMTP จริง
- Deadline Monitor ทำงานทุก 1 นาทีขณะเปิดแอปอยู่ — เมื่อมี backend ต้องย้ายไปเป็น cron ฝั่ง server เพื่อให้ทำงานแม้ไม่มีใครเปิดระบบ
- การตรวจสิทธิ์อยู่ใน `store.ts` ซึ่งเขียนแบบเดียวกับ API — ตอนทำ backend ให้ย้ายไปบังคับใช้ฝั่ง server
