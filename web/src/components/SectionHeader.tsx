import type { ReactNode } from "react";

/** Shared visual hierarchy; callers supply localized content. */
export function SectionHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <div className="section-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children && <div className="section-description">{children}</div>}</div>{actions}</div>;
}
