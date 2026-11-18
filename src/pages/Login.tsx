import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BellRing, CalendarDays, KanbanSquare, ShieldCheck } from "lucide-react";
import { ParkTalkLogo } from "@/components/parktalk/ParkTalkLogo";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/lib/parktalk/constants";
import { DEMO_PASSWORD } from "@/lib/parktalk/seed";
import { login, useCurrentUser, useDb } from "@/lib/parktalk/store";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const db = useDb();
  const current = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  if (current) return <Navigate to={from} replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const user = login(email, password);
      toast.success(`ยินดีต้อนรับ ${user.name}`);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const demoUsers = db.users.filter((u) => u.active).slice(0, 6);

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-background">
      <section className="relative hidden lg:flex bg-gradient-hero text-primary-foreground p-12 flex-col justify-between overflow-hidden">
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <ParkTalkLogo className="h-12 w-12 text-2xl rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ParkTalk</h1>
            <p className="text-xs uppercase tracking-[0.25em] text-primary-foreground/70">Dev Team Workspace</p>
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-5xl font-bold leading-tight">
            วางแผนงาน มอบหมายงาน
            <br />
            <span className="text-secondary">ไม่มีงานไหนหลุดกำหนด.</span>
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            ศูนย์กลางจัดการงานของทีม Development — กระดาน Kanban ปฏิทินกำหนดส่ง และแจ้งเตือนผ่านอีเมลบริษัท
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2"><KanbanSquare className="h-4 w-4 text-secondary" /> Kanban</span>
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-secondary" /> Calendar</span>
            <span className="flex items-center gap-2"><BellRing className="h-4 w-4 text-secondary" /> Deadline Alerts</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-secondary" /> Role & Permission</span>
          </div>
        </div>
        <div className="relative text-xs text-primary-foreground/50">© {new Date().getFullYear()} {db.settings.companyName}</div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <ParkTalkLogo className="h-10 w-10 text-xl" />
            <h1 className="text-xl font-bold">ParkTalk</h1>
          </div>
          <div>
            <h2 className="text-3xl font-bold">เข้าสู่ระบบ</h2>
            <p className="text-muted-foreground mt-1">ใช้บัญชีบริษัท (@{db.settings.emailDomain})</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">อีเมลบริษัท</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${db.settings.emailDomain}`} className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" required />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!email || !password}>
              เข้าสู่ระบบ
            </Button>
          </form>

          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">บัญชีทดลอง (ข้อมูลจำลอง)</p>
            <div className="grid gap-1.5">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                >
                  <span className="truncate">{u.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{ROLE_LABEL[u.role]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
