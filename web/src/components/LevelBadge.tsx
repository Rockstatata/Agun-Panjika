import { useTranslation } from "react-i18next";
import { LEVEL_COLOR } from "../lib/series";
import type { Level } from "../lib/types";

/** Alert level shown as icon + word, never colour alone. */
export function LevelIcon({ level, size = 20 }: { level: Level; size?: number }) {
  const c = LEVEL_COLOR[level];
  const common = { width: size, height: size, viewBox: "0 0 20 20", "aria-hidden": true };
  switch (level) {
    case "below":
      return (
        <svg {...common}>
          <path d="M10 15 4 6h12z" fill={c} />
        </svg>
      );
    case "normal":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6" fill={c} />
        </svg>
      );
    case "above":
      return (
        <svg {...common}>
          <path d="M10 4 16 14H4z" fill={c} />
        </svg>
      );
    case "extreme":
      return (
        <svg {...common}>
          <path d="M10 1 15 9H5zM10 9l5 8H5z" fill={c} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="4" y="9" width="12" height="2.5" rx="1" fill={c} />
        </svg>
      );
  }
}

export function LevelBadge({ level }: { level: Level }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold"
      style={{ color: LEVEL_COLOR[level], border: `1.5px solid ${LEVEL_COLOR[level]}` }}
    >
      <LevelIcon level={level} size={14} />
      {t(`level.${level}`)}
    </span>
  );
}
