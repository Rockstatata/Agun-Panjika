import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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
  const value=useMemo(()=>({show,hide}),[show,hide]);
  const left = tip ? Math.max(8,Math.min(tip.x + 14, window.innerWidth - Math.min(260,window.innerWidth-24) - 8)) : 0;
  const top = tip ? Math.max(8,tip.y + 160 > window.innerHeight ? tip.y - 145 : tip.y + 14) : 0;
  return (
    <Ctx.Provider value={value}>
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
