import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search } from "lucide-react";
import AppLayout from "@/components/parktalk/AppLayout";
import { AdminOnly } from "@/components/parktalk/AdminOnly";
import { EmptyState } from "@/components/parktalk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/parktalk/csv";
import { useDb } from "@/lib/parktalk/store";
import { fmtDateTime } from "@/lib/parktalk/time";
import type { AuditLog } from "@/lib/parktalk/types";

const ENTITY_LABEL: Record<AuditLog["entity"], string> = { task: "Task", project: "Project", user: "User", settings: "Settings" };
const PAGE = 50;

export default function AdminAuditLogs() {
  const db = useDb();
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<"all" | AuditLog["entity"]>("all");
  const [userId, setUserId] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const logs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.auditLogs
      .filter((l) => entity === "all" || l.entity === entity)
      .filter((l) => userId === "all" || l.userId === userId)
      .filter((l) => !q || `${l.entityId} ${l.action} ${l.detail}`.toLowerCase().includes(q));
  }, [db.auditLogs, search, entity, userId]);

  const nameOf = (id: string | null) => (id ? db.users.find((u) => u.id === id)?.name ?? id : "ระบบ");

  const exportCsv = () =>
    downloadCsv(
      `parktalk-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Timestamp", "User", "Action", "Entity", "Entity ID", "Detail"],
      logs.map((l) => [l.createdAt, nameOf(l.userId), l.action, l.entity, l.entityId, l.detail]),
    );

  return (
    <AppLayout
      title="ประวัติระบบ (Audit Log)"
      subtitle="บันทึกการสร้าง แก้ไข ลบ ย้าย มอบหมาย และเปลี่ยนกำหนดส่ง พร้อมผู้ทำรายการและเวลา"
      actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!logs.length}><Download className="h-4 w-4" /> Export CSV</Button>}
    >
      <AdminOnly>
        <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
          <div className="col-span-2 md:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา Task ID, การกระทำ, รายละเอียด..." className="pl-9 h-10 bg-card" />
          </div>
          <div className="md:col-span-3">
            <Select value={entity} onValueChange={(v) => setEntity(v as typeof entity)}>
              <SelectTrigger className="h-10 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                {Object.entries(ENTITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-10 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกผู้ใช้</SelectItem>
                {db.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {logs.length === 0 ? (
          <EmptyState>ยังไม่มีประวัติที่ตรงกับตัวกรอง</EmptyState>
        ) : (
          <Card className="shadow-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">เวลา</TableHead>
                  <TableHead>ผู้ทำรายการ</TableHead>
                  <TableHead>การกระทำ</TableHead>
                  <TableHead>อ้างอิง</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, limit).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(l.createdAt)}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{nameOf(l.userId)}</TableCell>
                    <TableCell><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{l.action}</span></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {ENTITY_LABEL[l.entity]}{" "}
                      {l.entity === "task" && db.tasks.some((t) => t.id === l.entityId) ? (
                        <Link to={`/tasks/${l.entityId}`} className="font-mono text-primary hover:underline">{l.entityId}</Link>
                      ) : (
                        <span className="font-mono text-muted-foreground">{l.entityId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{l.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
        {logs.length > limit && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>แสดงเพิ่ม ({logs.length - limit})</Button>
          </div>
        )}
      </AdminOnly>
    </AppLayout>
  );
}
