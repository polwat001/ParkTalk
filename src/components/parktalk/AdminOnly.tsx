import { can } from "@/lib/parktalk/permissions";
import { useCurrentUser, useDb } from "@/lib/parktalk/store";
import { EmptyState } from "./EmptyState";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const db = useDb();
  const me = useCurrentUser();
  if (!can(db, me, "manageUsers")) return <EmptyState>หน้านี้สำหรับ Super Admin เท่านั้น</EmptyState>;
  return <>{children}</>;
}
