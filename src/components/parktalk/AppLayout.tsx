import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  KanbanSquare,
  ListChecks,
  LogOut,
  Menu,
  Search,
  Settings,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "./GlobalSearch";
import { ParkTalkLogo } from "./ParkTalkLogo";
import { UserAvatar } from "./UserAvatar";
import { ROLE_LABEL } from "@/lib/parktalk/constants";
import { can } from "@/lib/parktalk/permissions";
import { logout, useCurrentUser, useDb } from "@/lib/parktalk/store";
import { cn } from "@/lib/utils";

export interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** full-width content instead of the centred container */
  wide?: boolean;
  /** page draws its own header and fills the remaining height (board) */
  bare?: boolean;
}

const ADMIN_LINKS = [
  { to: "/admin/users", label: "บัญชีผู้ใช้" },
  { to: "/admin/permissions", label: "กำหนดสิทธิ์" },
  { to: "/admin/settings", label: "ตั้งค่าระบบ" },
  { to: "/admin/audit-logs", label: "ประวัติระบบ (Audit Log)" },
];

export default function AppLayout({ children, title, subtitle, actions, wide, bare }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const db = useDb();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.title = `${title} · ParkTalk`;
  }, [title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;

  const unread = db.notifications.filter((n) => n.userId === user.id && !n.read).length;
  const myOpen = db.tasks.filter((t) => t.assigneeId === user.id && !["done", "documents"].includes(t.status)).length;
  const isAdmin = can(db, user, "manageUsers");
  const onBoard = location.pathname.startsWith("/projects") || location.pathname.startsWith("/tasks");

  const nav = [
    { to: "/projects", label: "บอร์ด", icon: KanbanSquare, active: onBoard },
    { to: "/my-tasks", label: "งานของฉัน", icon: ListChecks, badge: myOpen },
    { to: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
    { to: "/dashboard", label: "รายงาน", icon: BarChart3 },
    ...(can(db, user, "assignTask") ? [{ to: "/team/workload", label: "ทีม", icon: UsersRound }] : []),
  ];

  const handleLogout = () => {
    logout();
    toast.success("ออกจากระบบเรียบร้อยแล้ว");
    navigate("/login");
  };

  const navLink = (item: (typeof nav)[number], mobile = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive || item.active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
          mobile && "py-3 text-base",
        )
      }
    >
      <item.icon className="h-4 w-4" />
      {item.label}
      {"badge" in item && item.badge ? (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-[11px] font-bold grid place-items-center">{item.badge}</span>
      ) : null}
    </NavLink>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 z-30 h-14 border-b border-white/5 bg-[hsl(258_34%_8%)] text-white">
        <div className="h-full px-3 sm:px-4 flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden text-white hover:bg-white/10" onClick={() => setMenuOpen(true)} aria-label="เมนู">
            <Menu className="h-5 w-5" />
          </Button>
          <button onClick={() => navigate("/projects")} className="flex items-center gap-2 shrink-0" aria-label="ParkTalk หน้าแรก">
            <ParkTalkLogo />
            <span className="text-lg font-bold tracking-tight hidden sm:inline">ParkTalk</span>
          </button>

          <nav className="hidden lg:flex items-center gap-1 ml-2" aria-label="เมนูหลัก">
            {nav.map((item) => navLink(item))}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      location.pathname.startsWith("/admin") ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Settings className="h-4 w-4" /> ตั้งค่า <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ADMIN_LINKS.map((l) => (
                    <DropdownMenuItem key={l.to} onSelect={() => navigate(l.to)}>{l.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto lg:ml-4 flex-1 max-w-md hidden md:flex items-center gap-2 h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/50 hover:bg-white/10 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">ค้นหาการ์ด งาน หรือ @สมาชิก...</span>
            <kbd className="ml-auto rounded border border-white/15 px-1.5 text-[11px]">Ctrl K</kbd>
          </button>

          <div className="ml-auto md:ml-2 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10" onClick={() => setSearchOpen(true)} aria-label="ค้นหา">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10" onClick={() => navigate("/notifications")} aria-label={`การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-fuchsia-500 text-[10px] font-bold grid place-items-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-full pl-1 pr-1.5 py-1 hover:bg-white/10" aria-label="บัญชีของฉัน">
                  <UserAvatar user={user} />
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]} · {user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/notifications")}>การแจ้งเตือน</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleLogout} className="text-rose-300 focus:text-rose-200">
                  <LogOut className="h-4 w-4 mr-2" /> ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-[hsl(258_34%_8%)] text-white border-white/10">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-white"><ParkTalkLogo /> ParkTalk</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 space-y-1" aria-label="เมนูหลัก">
            {nav.map((item) => navLink(item, true))}
            {isAdmin && (
              <>
                <div className="pt-4 pb-1 px-3 text-xs uppercase tracking-wider text-white/40">ตั้งค่า</div>
                {ADMIN_LINKS.map((l) => navLink({ to: l.to, label: l.label, icon: Settings }, true))}
              </>
            )}
          </nav>
        </SheetContent>
      </Sheet>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {bare ? (
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      ) : (
        <main className="flex-1 min-w-0 overflow-y-auto scroll-thin">
          <div className={cn("py-6 space-y-5", wide ? "px-4 sm:px-6" : "container max-w-6xl")}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
          </div>
        </main>
      )}
    </div>
  );
}
