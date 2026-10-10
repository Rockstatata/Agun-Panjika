import { useState, type RefObject } from "react";
import { useFmt } from "../i18n";

/** Render a DOM node to PNG; share it on phones that support file sharing, otherwise download it. */
export function ShareButton({ target, filename, title }: { target: RefObject<HTMLElement>; filename: string; title: string }) {
  const { t } = useFmt();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!target.current) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const bg = getComputedStyle(document.body).backgroundColor;
      const blob = await toBlob(target.current, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
      if (!blob) return;
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn-primary" onClick={run} disabled={busy} aria-busy={busy}>
      <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2v10M6 6l4-4 4 4M4 11v6h12v-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("home.share")}
    </button>
  );
}
