import { beforeEach, describe, expect, it } from "vitest";
import { can, moveDeniedReason, moveKind } from "@/lib/parktalk/permissions";
import { createSeed, DEMO_PASSWORD } from "@/lib/parktalk/seed";
import {
  assignTask,
  claimTask,
  createTask,
  getDb,
  login,
  logout,
  moveTask,
  resetDemoData,
  runDeadlineCheckOn,
  updateUser,
} from "@/lib/parktalk/store";

const H = 3600_000;

describe("permissions", () => {
  const db = createSeed();
  const [admin, pm, lead, dev1] = db.users;
  const p1 = db.projects[0];
  const p2 = db.projects[1];

  it("follows the planning-doc matrix", () => {
    expect(can(db, admin, "manageUsers")).toBe(true);
    expect(can(db, pm, "createProject")).toBe(true);
    expect(can(db, lead, "createProject")).toBe(false);
    expect(can(db, lead, "assignTask", p1)).toBe(true);
    expect(can(db, dev1, "assignTask", p1)).toBe(false);
    expect(can(db, dev1, "selfAssign", p1)).toBe(true);
  });

  it("scopes non-admin roles to their projects", () => {
    expect(can(db, lead, "assignTask", p2)).toBe(false); // lead is not in P2
    expect(can(db, admin, "assignTask", p2)).toBe(true);
  });

  it("requires Review before Testing/Deploy/Done when a reviewer is set", () => {
    const t = db.tasks.find((x) => x.id === "PT-4")!; // in_progress, reviewer = lead
    expect(moveDeniedReason(db, lead, t, "testing")).toMatch(/Review/);
    expect(moveDeniedReason(db, lead, t, "done")).toMatch(/Review/);
    const review = db.tasks.find((x) => x.id === "PT-7")!; // review, assignee dev1
    expect(moveDeniedReason(db, lead, review, "testing")).toBeNull();
    expect(moveDeniedReason(db, dev1, review, "testing")).not.toBeNull();
    expect(moveKind(review, "in_progress")).toBe("revision");
    expect(moveKind(review, "testing")).toBe("approve");
    const testing = db.tasks.find((x) => x.id === "PT-10")!; // approved, assignee dev1
    expect(moveDeniedReason(db, dev1, testing, "deploy")).toBeNull();
    expect(moveDeniedReason(db, dev1, testing, "done")).toMatch(/ผู้ตรวจรับ/);
  });
});

describe("store actions", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoData();
    logout();
  });

  it("notifies old and new assignee on reassignment with reason", () => {
    login("lead@parktalk.co", DEMO_PASSWORD);
    expect(() => assignTask("PT-2", "U4", "")).toThrow(/เหตุผล/);
    assignTask("PT-2", "U4", "ย้ายภาระงาน");
    const db = getDb();
    expect(db.tasks.find((t) => t.id === "PT-2")!.assigneeId).toBe("U4");
    expect(db.notifications.some((n) => n.userId === "U4" && n.type === "reassigned")).toBe(true);
    expect(db.notifications.some((n) => n.userId === "U5" && n.type === "reassigned")).toBe(true);
    expect(db.emails.some((e) => e.to === "dev1@parktalk.co")).toBe(true);
    expect(db.auditLogs[0].action).toBe("reassign");
  });

  it("lets a developer claim an open task but not assign", () => {
    login("dev2@parktalk.co", DEMO_PASSWORD);
    expect(() => assignTask("PT-2", "U4", "x")).toThrow();
    claimTask("PT-3");
    expect(getDb().tasks.find((t) => t.id === "PT-3")!.assigneeId).toBe("U5");
  });

  it("does not let users change their own role", () => {
    login("admin@parktalk.co", DEMO_PASSWORD);
    expect(() => updateUser("U1", { role: "developer" })).toThrow();
  });

  it("review flow: submit, revision with reason, approve, close", () => {
    login("dev1@parktalk.co", DEMO_PASSWORD);
    const t = createTask({ projectId: "P1", boardId: "B1", title: "x", description: "", priority: "low", dueDate: new Date(Date.now() + 99 * H).toISOString(), assigneeId: "U4", reviewerId: "U3" });
    expect(t.status).toBe("todo");
    moveTask(t.id, "in_progress");
    expect(() => moveTask(t.id, "testing")).toThrow(/Review/);
    moveTask(t.id, "review");
    expect(() => moveTask(t.id, "testing")).toThrow();
    logout();
    login("lead@parktalk.co", DEMO_PASSWORD);
    expect(() => moveTask(t.id, "in_progress")).toThrow(/เหตุผล/);
    moveTask(t.id, "in_progress", "แก้ test");
    let cur = getDb().tasks.find((x) => x.id === t.id)!;
    expect(cur.inRevision).toBe(true);
    expect(getDb().notifications.some((n) => n.userId === "U4" && n.type === "revision")).toBe(true);
    logout();
    login("dev1@parktalk.co", DEMO_PASSWORD);
    moveTask(t.id, "review");
    logout();
    login("lead@parktalk.co", DEMO_PASSWORD);
    moveTask(t.id, "testing");
    cur = getDb().tasks.find((x) => x.id === t.id)!;
    expect(cur.approvedAt).not.toBeNull();
    expect(cur.inRevision).toBe(false);
    moveTask(t.id, "done");
    cur = getDb().tasks.find((x) => x.id === t.id)!;
    expect(cur.status).toBe("done");
    expect(cur.completedAt).not.toBeNull();
    expect(cur.revisionCount).toBe(1);
  });

  it("orders cards within a list and blocks creating straight into Done", () => {
    login("lead@parktalk.co", DEMO_PASSWORD);
    const order = () => getDb().tasks.filter((t) => t.projectId === "P1" && t.status === "todo").sort((a, b) => a.order - b.order).map((t) => t.id);
    const first = order()[0];
    moveTask("PT-20", "todo", "", first);
    expect(order()[0]).toBe("PT-20");
    moveTask("PT-20", "todo", "", null);
    expect(order().at(-1)).toBe("PT-20");
    expect(() => createTask({ projectId: "P1", boardId: "B1", title: "x", description: "", priority: "low", dueDate: new Date().toISOString(), status: "done" })).toThrow();
  });
});

describe("deadline monitor", () => {
  it("sends due-soon and overdue once, escalates, and repeats per window", () => {
    const now = Date.now();
    const db = createSeed(now);
    runDeadlineCheckOn(db, now);
    const first = db.notifications.length;
    // PT-5 overdue 6h → assignee; PT-6 due in 10h → due soon; documents ignored
    expect(db.notifications.some((n) => n.type === "overdue" && n.taskId === "PT-5" && n.userId === "U5")).toBe(true);
    expect(db.notifications.some((n) => n.type === "due_soon" && n.taskId === "PT-6")).toBe(true);
    expect(db.notifications.some((n) => n.taskId === "PT-18")).toBe(false);
    expect(db.notifications.some((n) => n.type === "overdue_escalation")).toBe(false);

    runDeadlineCheckOn(db, now + 60_000);
    expect(db.notifications.length).toBe(first); // dedup

    runDeadlineCheckOn(db, now + 25 * H);
    expect(db.notifications.some((n) => n.type === "overdue_escalation" && n.taskId === "PT-5" && n.userId === "U3")).toBe(true);
    expect(db.notifications.filter((n) => n.type === "overdue" && n.taskId === "PT-5").length).toBe(2); // daily repeat
  });

  it("queues email outside working hours and flushes later", () => {
    const db = createSeed();
    db.settings.workingHoursOnly = true;
    const sunday = new Date("2026-11-22T10:00:00").getTime();
    runDeadlineCheckOn(db, sunday);
    // seed due dates are relative to real now, so only check queue behaviour
    db.emails.push({ id: "x", to: "a", toUserId: "U4", subject: "s", body: "b", createdAt: "", status: "queued", sentAt: null });
    runDeadlineCheckOn(db, sunday);
    expect(db.emails.find((e) => e.id === "x")!.status).toBe("queued");
    runDeadlineCheckOn(db, new Date("2026-11-23T10:00:00").getTime()); // Monday
    expect(db.emails.find((e) => e.id === "x")!.status).toBe("sent");
  });
});
