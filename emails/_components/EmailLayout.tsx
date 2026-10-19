import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Tailwind,
} from "@react-email/components";
import * as React from "react";
import type { Language } from "../_lib/types";
import { EmailFooter } from "./EmailFooter";
import { EmailHeader } from "./EmailHeader";

interface EmailLayoutProps {
  language: Language;
  preview?: string;
  children: React.ReactNode;
}

// Adaptive light/dark palette. Inline styles/attributes below set the LIGHT
// values (the fallback every client sees, including ones that strip <style>
// blocks entirely). The <style> block re-declares the same rules under
// @media (prefers-color-scheme: dark) with !important, which is the only way
// to win over an inline style — clients that support prefers-color-scheme
// switch to these; clients that don't just keep the light fallback.
//
// Every semantic class here (.neon-*) is a plain custom class name, not a
// Tailwind utility — <Tailwind> only inlines/strips utilities it recognizes,
// so these pass through untouched and stay available for the media query
// to target.
const ADAPTIVE_STYLE = `
  .neon-bg { background-color: #ffffff; }
  .neon-border { border-color: #e5e7eb; }
  .neon-divider { border-color: #e5e7eb; }
  .neon-heading { color: #111827; }
  .neon-text { color: #374151; }
  .neon-text-muted { color: #6b7280; }
  .neon-text-faint { color: #9ca3af; }
  .neon-link { color: #2563eb; }
  .neon-danger-heading { color: #dc2626; }
  .neon-danger-text { color: #b91c1c; }
  .neon-danger-box { background-color: #fef2f2; border-color: #fecaca; }
  .neon-badge { background-color: #f3f4f6; }

  @media (prefers-color-scheme: dark) {
    .neon-bg { background-color: #121212 !important; }
    .neon-border { border-color: #ffffff !important; }
    .neon-divider { border-color: #374151 !important; }
    .neon-heading { color: #ffffff !important; }
    .neon-text { color: #d1d5db !important; }
    .neon-text-muted { color: #9ca3af !important; }
    .neon-text-faint { color: #6b7280 !important; }
    .neon-link { color: #60a5fa !important; }
    .neon-danger-heading { color: #ef4444 !important; }
    .neon-danger-text { color: #f87171 !important; }
    .neon-danger-box { background-color: #281717 !important; border-color: #542121 !important; }
    .neon-badge { background-color: #1e1e1e !important; }
  }
`;

export function EmailLayout({ language, preview, children }: EmailLayoutProps) {
  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <Html dir={dir} lang={language}>
      <Head>
        {/*
          "light dark" tells clients that support prefers-color-scheme this
          email adapts to either — unlike a locked "dark" value, it lets the
          media query below actually take effect instead of forcing one mode.
        */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{ADAPTIVE_STYLE}</style>

        <Font
          fontFamily="Tajawal"
          fallbackFontFamily={["Arial", "Helvetica", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/tajawal/v12/Iura6YBj_oCad4k1nzSBC45I.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Tajawal"
          fallbackFontFamily={["Arial", "Helvetica", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/tajawal/v12/Iurf6YBj_oCad4k1l4qkHrRpiYlJ.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      {preview ? <Preview>{preview}</Preview> : null}
      <Tailwind>
        <Body
          bgcolor="#ffffff"
          className="neon-bg neon-heading p-4"
          style={{
            margin: 0,
            backgroundColor: "#ffffff",
            color: "#111827",
            fontFamily:
              language === "ar"
                ? "Tajawal, Arial, Helvetica, sans-serif"
                : "Inter, Helvetica, Arial, sans-serif",
          }}
        >
          <Container
            bgcolor="#ffffff"
            className="neon-bg neon-heading neon-border border p-8 max-w-[460px] mx-auto text-center"
            style={{ backgroundColor: "#ffffff", color: "#111827", borderRadius: "16px" }}
          >
            <EmailHeader />
            {children}
            <EmailFooter language={language} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
