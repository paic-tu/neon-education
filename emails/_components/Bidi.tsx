import * as React from "react";

interface LtrProps {
  children: React.ReactNode;
}

/**
 * Isolates content (codes, URLs, emails, numbers, device names, dates) so it
 * never mirrors when rendered inside an RTL (Arabic) email context.
 * dir="ltr" is the primary defense (works even when clients strip CSS);
 * unicode-bidi:isolate reinforces it for clients that keep inline styles.
 */
export function Ltr({ children }: LtrProps) {
  return (
    <span
      dir="ltr"
      style={{ direction: "ltr", unicodeBidi: "isolate", display: "inline-block" }}
    >
      {children}
    </span>
  );
}
