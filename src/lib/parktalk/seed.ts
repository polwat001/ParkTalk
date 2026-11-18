import { DEFAULT_PERMISSIONS } from "./constants";
import type { Database, Task, User } from "./types";

/** Demo password for every seeded account (mock data only). */
export const DEMO_PASSWORD = "parktalk123";

const H = 3600_000;
const D = 24 * H;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

export function createSeed(now = Date.now()): Database {
  const created = iso(now - 30 * D);
  const users: User[] = [
    { id: "U1", name: "ภาณุ ศรีวงศ์", email: "admin@parktalk.co", role: "super_admin", department: "IT", active: true },
    { id: "U2", name: "กมลวรรณ ใจดี", email: "pm@parktalk.co", role: "project_manager", department: "Product", active: true },
    { id: "U3", name: "ธนกร พัฒนกิจ", email: "lead@parktalk.co", role: "team_leader", department: "Development", active: true },
    { id: "U4", name: "ศิริพร มั่นคง", email: "dev1@parktalk.co", role: "developer", department: "Development", active: true },
    { id: "U5", name: "อนุชา แก้วกาญจน์", email: "dev2@parktalk.co", role: "developer", department: "Development", active: true },
    { id: "U6", name: "ณัฐธิดา บุญมา", email: "qa@parktalk.co", role: "developer", department: "QA", active: true },
  ].map((u) => ({ ...u, password: DEMO_PASSWORD, createdAt: created })) as User[];

  let order = 0;
  const base = (partial: Partial<Task> & Pick<Task, "id" | "title" | "status" | "dueDate">): Task => ({
    projectId: "P1",
    boardId: "B1",
    description: "",
    priority: "medium",
    assigneeId: null,
    collaboratorIds: [],
    reviewerId: "U3",
    openForClaim: false,
    startDate: null,
    recurrence: "none",
    labels: [],
    order: order++,
    approvedAt: null,
    inRevision: false,
    checklist: [],
    attachments: [],
    comments: [],
    activity: [{ id: `A-${partial.id}`, userId: "U3", text: "สร้างการ์ด", createdAt: iso(now - 5 * D) }],
    revisionCount: 0,
    createdBy: "U3",
    createdAt: iso(now - 5 * D),
    updatedAt: iso(now - 1 * D),
    completedAt: null,
    ...partial,
  });
  const checks = (total: number, done: number) =>
    Array.from({ length: total }, (_, i) => ({ id: `C${order}-${i}`, text: `รายการตรวจสอบ ${i + 1}`, done: i < done }));
  const talk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `M${order}-${i}`, userId: i % 2 ? "U3" : "U4", body: i % 2 ? "รับทราบครับ" : "อัปเดตความคืบหน้าแล้ว", createdAt: iso(now - (n - i) * H) }));
  const approved = iso(now - 1 * D);

  const tasks: Task[] = [
    // To Do
    base({ id: "PT-1", title: "ออกแบบหน้าจอลงชื่อเข้าใช้ (เวอร์ชันใหม่)", description: "ปรับดีไซน์และ flow การยืนยันตัวตน", labels: ["uiux"], status: "todo", assigneeId: "U4", dueDate: iso(now + 3 * D), checklist: checks(4, 0) }),
    base({ id: "PT-2", title: "พัฒนา API รายงานการใช้งาน", description: "สร้าง endpoint สำหรับดึงข้อมูลสรุปการใช้งาน", labels: ["backend"], status: "todo", assigneeId: "U5", boardId: "B2", dueDate: iso(now + 4 * D), comments: talk(2) }),
    base({ id: "PT-3", title: "ตั้งค่า CI/CD บนเซิร์ฟเวอร์ใหม่", description: "ปรับ pipeline ให้รองรับการ deploy อัตโนมัติ", labels: ["devops"], status: "todo", openForClaim: true, boardId: "B2", dueDate: iso(now + 6 * D), checklist: checks(3, 0) }),
    // In Progress
    base({ id: "PT-4", title: "พัฒนาหน้าจัดการผู้ใช้", description: "เพิ่ม/แก้ไข/ปิดใช้งานผู้ใช้ และกำหนดสิทธิ์", labels: ["frontend"], status: "in_progress", assigneeId: "U4", startDate: iso(now - 2 * D), dueDate: iso(now + 2 * D), checklist: checks(5, 2), comments: talk(3) }),
    base({ id: "PT-5", title: "ปรับปรุงฐานข้อมูล (User & Permission)", description: "เพิ่ม field และปรับโครงสร้างให้รองรับฟีเจอร์ใหม่", labels: ["backend"], priority: "critical", status: "in_progress", assigneeId: "U5", collaboratorIds: ["U4"], boardId: "B2", startDate: iso(now - 3 * D), dueDate: iso(now - 6 * H), comments: talk(1) }),
    // Review
    base({ id: "PT-6", title: "ตรวจโค้ด: โมดูลแจ้งเตือน", description: "ตรวจความถูกต้อง โค้ดสไตล์ และ performance", labels: ["backend"], priority: "high", status: "review", assigneeId: "U5", boardId: "B2", dueDate: iso(now + 10 * H), checklist: checks(5, 2), comments: talk(3) }),
    base({ id: "PT-7", title: "ทบทวน UI/UX ก่อนปล่อย", description: "ตรวจความครบถ้วนของหน้าจอและการใช้งาน", labels: ["uiux"], status: "review", assigneeId: "U4", dueDate: iso(now + 2 * D), checklist: checks(1, 1), comments: talk(2) }),
    // Testing
    base({ id: "PT-8", title: "ทดสอบการส่งอีเมลแจ้งเตือน", description: "ตรวจการทำงานทั้งกรณีปกติและเกิดข้อผิดพลาด", labels: ["qa"], status: "testing", assigneeId: "U6", boardId: "B3", approvedAt: approved, dueDate: iso(now + 3 * D), checklist: checks(2, 2), comments: talk(1) }),
    base({ id: "PT-9", title: "ทดสอบความเสถียรของระบบ", description: "Load test และตรวจสอบการใช้งานพร้อมกัน", labels: ["devops"], priority: "high", status: "testing", assigneeId: "U6", boardId: "B3", approvedAt: approved, dueDate: iso(now + 20 * H), revisionCount: 1, comments: talk(3) }),
    base({ id: "PT-10", title: "ทดสอบฟีเจอร์สร้างรายงาน (PDF/Excel)", description: "ตรวจสอบผลลัพธ์และรูปแบบไฟล์", labels: ["qa"], status: "testing", assigneeId: "U4", boardId: "B3", approvedAt: approved, dueDate: iso(now + 5 * D), checklist: checks(4, 2), comments: talk(2) }),
    // Deploy
    base({ id: "PT-11", title: "เตรียมการปล่อยเวอร์ชัน v2.4.0", description: "รวมงานที่ผ่านการทดสอบ และตรวจสอบ checklist ก่อน deploy", labels: ["devops"], priority: "high", status: "deploy", assigneeId: "U5", boardId: "B2", approvedAt: approved, dueDate: iso(now + 2 * D), checklist: checks(5, 4), comments: talk(2) }),
    // Done
    base({ id: "PT-12", title: "แก้ไขปัญหา login ค้าง", description: "แก้ token หมดอายุและปรับการต่ออายุอัตโนมัติ", labels: ["bug"], status: "done", assigneeId: "U4", approvedAt: approved, dueDate: iso(now - 2 * D), completedAt: iso(now - 3 * D), comments: talk(1) }),
    base({ id: "PT-13", title: "ปรับหน้ารายงานตาม feedback", description: "ปรับ layout และเพิ่มตัวกรองข้อมูล", labels: ["frontend"], status: "done", assigneeId: "U4", approvedAt: approved, dueDate: iso(now - 4 * D), completedAt: iso(now - 4 * D - 3 * H), comments: talk(3) }),
    base({ id: "PT-14", title: "อัปเดตคู่มือการใช้งาน (ผู้ดูแลระบบ)", description: "เพิ่มขั้นตอนการตั้งค่าและภาพประกอบ", labels: ["docs"], status: "done", assigneeId: "U6", approvedAt: approved, dueDate: iso(now - 5 * D), completedAt: iso(now - 4 * D) }),
    base({ id: "PT-15", title: "ปรับปรุงประสิทธิภาพการค้นหา", description: "ลดเวลา response ลง ~40%", labels: ["backend"], status: "done", assigneeId: "U5", boardId: "B2", approvedAt: approved, dueDate: iso(now - 6 * D), completedAt: iso(now - 7 * D), comments: talk(1) }),
    // Standby
    base({ id: "PT-16", title: "งานเชื่อมต่อระบบ HR (ถัดไป)", description: "รอข้อมูล requirement จากทีม HR", labels: ["uiux"], status: "standby", dueDate: iso(now + 14 * D), checklist: checks(3, 0) }),
    base({ id: "PT-17", title: "พัฒนา API เชื่อมระบบบัญชีการเงิน", description: "รอการยืนยัน spec จากทีมบัญชี", labels: ["frontend"], status: "standby", openForClaim: true, boardId: "B2", dueDate: iso(now + 21 * D), checklist: checks(4, 0) }),
    // Documents
    base({ id: "PT-18", title: "คู่มือการพัฒนาระบบ (ParkTalk Dev Guide)", description: "มาตรฐานการพัฒนา, Coding Guideline และการ Deploy", labels: ["docs"], status: "documents", reviewerId: null, dueDate: iso(now + 60 * D), attachments: [{ id: "F1", name: "ParkTalk Dev Guide v1.3", url: "https://example.com/parktalk-dev-guide", addedBy: "U3", addedAt: iso(now - 9 * D) }] }),
    base({ id: "PT-19", title: "สไลด์สรุปสถาปัตยกรรมระบบ", description: "สไลด์สำหรับ onboarding ทีมใหม่", labels: ["docs"], status: "documents", reviewerId: null, dueDate: iso(now + 60 * D), attachments: [{ id: "F2", name: "ParkTalk Architecture.png", url: "/samples/parktalk-architecture.svg", addedBy: "U3", addedAt: iso(now - 6 * D) }] }),
    base({ id: "PT-21", title: "Mockup หน้าจอเวอร์ชันใหม่", description: "ต้นแบบ UI สำหรับเวอร์ชัน 2.5", labels: ["uiux"], status: "documents", reviewerId: null, dueDate: iso(now + 60 * D), attachments: [
      { id: "F3", name: "Dashboard mockup.png", url: "/samples/dashboard-mockup.svg", addedBy: "U4", addedAt: iso(now - 3 * D) },
      { id: "F4", name: "Board mockup.fig", url: "https://example.com/board-mockup", addedBy: "U4", addedAt: iso(now - 3 * D) },
    ] }),
    base({ id: "PT-20", title: "Daily build & smoke test", description: "รันชุดทดสอบหลักทุกวัน", labels: ["qa"], priority: "low", status: "todo", assigneeId: "U6", boardId: "B3", recurrence: "daily", dueDate: iso(now + 8 * D) }),
    // Mobile project
    base({ id: "MB-1", projectId: "P2", boardId: "B4", title: "ปรับ UI หน้าแรกแอปมือถือ", labels: ["frontend"], status: "in_progress", assigneeId: "U4", reviewerId: "U2", createdBy: "U2", dueDate: iso(now + 2 * D) }),
    base({ id: "MB-2", projectId: "P2", boardId: "B4", title: "แก้ crash ตอนเปิดกล้อง", labels: ["bug"], priority: "critical", status: "todo", openForClaim: true, reviewerId: "U2", createdBy: "U2", dueDate: iso(now + 1 * D) }),
  ];

  return {
    version: 3,
    users,
    projects: [
      {
        id: "P1",
        key: "PT",
        name: "Dev Team",
        description: "บอร์ดวางแผนและติดตามงานพัฒนาระบบภายในบริษัท",
        ownerId: "U2",
        startDate: iso(now - 30 * D),
        endDate: iso(now + 60 * D),
        members: [
          { userId: "U2", projectRole: "manager" },
          { userId: "U3", projectRole: "leader" },
          { userId: "U4", projectRole: "member" },
          { userId: "U5", projectRole: "member" },
          { userId: "U6", projectRole: "member" },
        ],
        boards: [
          { id: "B1", name: "Frontend" },
          { id: "B2", name: "Backend" },
          { id: "B3", name: "QA" },
        ],
        archived: false,
        createdAt: created,
      },
      {
        id: "P2",
        key: "MB",
        name: "Mobile App",
        description: "แอปมือถือสำหรับลูกค้า",
        ownerId: "U2",
        startDate: iso(now - 10 * D),
        endDate: iso(now + 90 * D),
        members: [
          { userId: "U2", projectRole: "manager" },
          { userId: "U4", projectRole: "member" },
          { userId: "U5", projectRole: "member" },
        ],
        boards: [{ id: "B4", name: "Mobile" }],
        archived: false,
        createdAt: created,
      },
    ],
    tasks,
    notifications: [],
    emails: [],
    auditLogs: [],
    settings: {
      companyName: "ParkTalk Co., Ltd.",
      emailDomain: "parktalk.co",
      reminderHours: [24],
      overdueRepeatHours: 24,
      escalateAfterHours: 24,
      emailEnabled: true,
      workingHoursOnly: false,
      workStart: "09:00",
      workEnd: "18:00",
      permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS)),
    },
    sentKeys: [],
    counters: { P1: 21, P2: 2 },
  };
}
