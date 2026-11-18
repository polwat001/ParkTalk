import { useEffect, useRef } from "react";

const IGNORE = "[data-card], button, a, input, textarea, select, [role='menu'], [role='dialog'], [data-no-pan]";

/**
 * Click-and-drag on empty board space scrolls it sideways (mouse only),
 * like the pan on FixFlow's Technician Board. Cards keep their own drag.
 */
export function useDragPan(ref: React.RefObject<HTMLElement>, enabled = true) {
  const state = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType !== "mouse") return;
      if ((e.target as HTMLElement).closest(IGNORE)) return;
      state.current = { x: e.clientX, left: el.scrollLeft, moved: false };
      el.classList.add("cursor-grabbing");
      e.preventDefault();
    };
    const move = (e: PointerEvent) => {
      const s = state.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) > 3) s.moved = true;
      el.scrollLeft = s.left - dx;
    };
    const up = () => {
      if (!state.current) return;
      state.current = null;
      el.classList.remove("cursor-grabbing");
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [ref, enabled]);
}
