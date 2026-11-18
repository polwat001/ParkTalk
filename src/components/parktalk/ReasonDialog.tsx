import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  singleLine?: boolean;
  /** return false to keep the dialog open */
  onConfirm: (value: string) => boolean | void;
}

/** Small prompt for a required reason or name (reassign, revision, new board). */
export function ReasonDialog({ open, onOpenChange, title, description, label = "เหตุผล", placeholder, confirmLabel, singleLine, onConfirm }: Props) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (onConfirm(value.trim()) !== false) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form id="reason-form" onSubmit={submit} className="space-y-2">
          <Label htmlFor="reason-input">{label} *</Label>
          {singleLine ? (
            <Input id="reason-input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
          ) : (
            <Textarea id="reason-input" autoFocus rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button type="submit" form="reason-form" disabled={!value.trim()}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
