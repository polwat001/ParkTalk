import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, SquareKanban, User as UserIcon } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { STATUS_LABEL } from "@/lib/parktalk/constants";
import { visibleProjects } from "@/lib/parktalk/permissions";
import { useCurrentUser, useDb } from "@/lib/parktalk/store";

/** Ctrl K palette: cards, projects and members the user can see. */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const projects = useMemo(() => visibleProjects(db, me), [db, me]);
  const tasks = useMemo(() => db.tasks.filter((t) => projects.some((p) => p.id === t.projectId)), [db.tasks, projects]);
  const members = useMemo(() => {
    const ids = new Set(projects.flatMap((p) => p.members.map((m) => m.userId)));
    return db.users.filter((u) => ids.has(u.id) && u.active);
  }, [db.users, projects]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="ค้นหาการ์ด งาน หรือ @สมาชิก..." />
      <CommandList>
        <CommandEmpty>ไม่พบผลลัพธ์</CommandEmpty>
        <CommandGroup heading="การ์ดงาน">
          {tasks.map((t) => (
            <CommandItem key={t.id} value={`${t.id} ${t.title}`} onSelect={() => go(`/tasks/${t.id}`)}>
              <SquareKanban className="mr-2" />
              <span className="font-mono text-xs text-muted-foreground mr-2">{t.id}</span>
              <span className="truncate">{t.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">{STATUS_LABEL[t.status]}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="บอร์ด / โครงการ">
          {projects.map((p) => (
            <CommandItem key={p.id} value={`project ${p.name} ${p.key}`} onSelect={() => go(`/projects/${p.id}/board`)}>
              <FolderKanban className="mr-2" /> {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="สมาชิก">
          {members.map((u) => (
            <CommandItem key={u.id} value={`@${u.name} ${u.email}`} onSelect={() => go(`/calendar?member=${u.id}`)}>
              <UserIcon className="mr-2" /> @{u.name}
              <span className="ml-auto text-xs text-muted-foreground">ดูปฏิทินงาน</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
