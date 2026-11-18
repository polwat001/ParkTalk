import { toast } from "sonner";

/** Runs a store action and shows its outcome as a toast. Returns true on success. */
export function run(action: () => unknown, success?: string): boolean {
  try {
    action();
    if (success) toast.success(success);
    return true;
  } catch (err) {
    toast.error((err as Error).message || "เกิดข้อผิดพลาด");
    return false;
  }
}
