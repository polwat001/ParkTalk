import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <div className="text-center space-y-3">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="text-2xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
        <Button asChild><Link to="/dashboard">กลับหน้าภาพรวม</Link></Button>
      </div>
    </main>
  );
}
