import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

const Ctx = createContext<{ show: (x: number, y: number, c: ReactNode) => void; hide: () => void }>({
  show: () => {},
  hide: () => {},
});

/** One floating tooltip for the whole app; charts call show/hide. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = useCallback((x: number, y: number, content: ReactNode) => setTip({ x, y, content }), []);
  const hide = useCallback(() => setTip(null), []);
  const left = tip ? Math.min(tip.x + 14, window.innerWidth - 270) : 0;
  const top = tip ? (tip.y + 120 > window.innerHeight ? tip.y - 90 : tip.y + 14) : 0;
  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div className="tooltip" style={{ left, top }} role="status">
          {tip.content}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useTooltip = () => useContext(Ctx);
