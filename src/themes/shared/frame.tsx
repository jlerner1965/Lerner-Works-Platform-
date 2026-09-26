import type { CSSProperties, ReactNode } from "react";
import type { SectionAppearance } from "@/modules/page";
import { bandVariables, contentWidthClass } from "@/themes/shared/design";

/**
 * Frame of one page section: the band (background colour across the full width with the
 * `--section-*` colours set for everything inside), the alignment, and the content width.
 * Sections on the page background get no band; they only take the width and alignment.
 * `narrowAlign` says where a reading-width section sits: centred on the page (the guide) or at
 * the start of the container (the retail composition), each as the theme laid it out before D1.
 */
export function SectionFrame({ appearance, narrow = false, narrowAlign = "center", className = "", children }: { appearance: SectionAppearance; narrow?: boolean; narrowAlign?: "center" | "start"; className?: string; children: ReactNode }) {
  const band = appearance.background !== "default";
  const style = band ? (bandVariables(appearance.background) as CSSProperties) : undefined;
  const align = appearance.align === "center" ? " text-center" : "";
  const readingWidth = appearance.width === "narrow" || (appearance.width === "default" && narrow);
  return (
    <section className={`${band ? "lw-band bg-(--section-bg) py-(--band-pad) text-(--section-fg)" : ""}${align} ${className}`.trim()} style={style}>
      {readingWidth && narrowAlign === "start" ? (
        <div className="mx-auto max-w-(--container) px-4">
          <div className="max-w-3xl">{children}</div>
        </div>
      ) : (
        <div className={`mx-auto px-4 ${contentWidthClass(appearance, narrow)}`}>{children}</div>
      )}
    </section>
  );
}

/** Container for routes that are not made of sections (detail, listing and search pages). */
export function PageContainer({ children, className = "", narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={`mx-auto px-4 ${narrow ? "max-w-3xl" : "max-w-(--container)"} ${className}`.trim()}>{children}</div>;
}
