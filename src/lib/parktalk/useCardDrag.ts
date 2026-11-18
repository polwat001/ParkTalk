import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "./types";

export interface DropTarget {
  status: TaskStatus;
  beforeId: string | null;
}

export interface DragState {
  id: string;
  x: number;
  y: number;
  offX: number;
  offY: number;
  width: number;
  height: number;
  over: DropTarget | null;
}

const START_DISTANCE = 5;
const EDGE = 70;
const SPEED = 14;

/**
 * Pointer-based card drag (mouse and pen). Lists are marked with `data-list`,
 * cards with `data-card`, the horizontal scroller is `scrollerRef`.
 * Touch keeps native scrolling; a tap opens the card.
 */
export function useCardDrag(scrollerRef: React.RefObject<HTMLElement>, onDrop: (id: string, target: DropTarget) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pending = useRef<{ task: Task; sx: number; sy: number; rect: DOMRect } | null>(null);
  const suppressClick = useRef(false);
  const raf = useRef<number>(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const hitTest = (x: number, y: number, id: string): DropTarget | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-list]");
    if (!el) return null;
    const status = el.dataset.list as TaskStatus;
    const cards = [...el.querySelectorAll<HTMLElement>("[data-card]")].filter((c) => c.dataset.card !== id);
    const before = cards.find((c) => {
      const r = c.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return { status, beforeId: before?.dataset.card ?? null };
  };

  const autoScroll = useCallback(() => {
    const d = dragRef.current;
    const scroller = scrollerRef.current;
    if (d && scroller) {
      const r = scroller.getBoundingClientRect();
      if (d.x < r.left + EDGE) scroller.scrollLeft -= SPEED;
      else if (d.x > r.right - EDGE) scroller.scrollLeft += SPEED;
      const list = document.elementFromPoint(d.x, d.y)?.closest<HTMLElement>("[data-list]")?.querySelector<HTMLElement>("[data-list-body]");
      if (list) {
        const lr = list.getBoundingClientRect();
        if (d.y < lr.top + 40) list.scrollTop -= SPEED / 2;
        else if (d.y > lr.bottom - 40) list.scrollTop += SPEED / 2;
      }
      raf.current = requestAnimationFrame(autoScroll);
    }
  }, [scrollerRef]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      const d = dragRef.current;
      if (!d) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < START_DISTANCE) return;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        update({
          id: p.task.id,
          x: e.clientX,
          y: e.clientY,
          offX: p.sx - p.rect.left,
          offY: p.sy - p.rect.top,
          width: p.rect.width,
          height: p.rect.height,
          over: hitTest(e.clientX, e.clientY, p.task.id),
        });
        raf.current = requestAnimationFrame(autoScroll);
        return;
      }
      update({ ...d, x: e.clientX, y: e.clientY, over: hitTest(e.clientX, e.clientY, d.id) });
    };
    const end = (e: PointerEvent) => {
      const d = dragRef.current;
      pending.current = null;
      cancelAnimationFrame(raf.current);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (!d) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      const target = e.type === "pointerup" ? d.over : null;
      update(null);
      if (target) onDropRef.current(d.id, target);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current) end(new PointerEvent("pointercancel"));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", key);
      cancelAnimationFrame(raf.current);
    };
  }, [autoScroll]);

  const startDrag = (e: React.PointerEvent<HTMLElement>, task: Task) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
    pending.current = { task, sx: e.clientX, sy: e.clientY, rect: e.currentTarget.getBoundingClientRect() };
  };

  /** wrap a card's click handler so the click that ends a drag is ignored */
  const guardClick = (fn: (id: string) => void) => (id: string) => {
    if (!suppressClick.current) fn(id);
  };

  return { drag, startDrag, guardClick };
}
