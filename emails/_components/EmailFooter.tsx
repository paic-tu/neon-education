import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { copy } from "../_lib/copy";
import type { Language } from "../_lib/types";
import { Ltr } from "./Bidi";
import { SocialIcons } from "./SocialIcons";

interface EmailFooterProps {
  language: Language;
  currentYear?: number;
  privacyUrl?: string;
  termsUrl?: string;
}

export function EmailFooter({
  language,
  currentYear = new Date().getFullYear(),
  privacyUrl,
  termsUrl,
}: EmailFooterProps) {
  return (
    <Section className="border-t neon-divider mt-8 pt-6">
      <SocialIcons />
      <Text className="neon-text-muted text-sm mb-2">
        <Link href="https://linktr.ee/neonedusa" className="neon-link underline">
          {copy.contactUs[language]}
        </Link>
      </Text>
      {/*
        Policy links only render once real URLs are supplied — no
        placeholder/guessed URL is used, per spec item "روابط الدعم
        والسياسات" (Lama's identity requirements, page 2).
      */}
      {(privacyUrl || termsUrl) && (
        <Text className="neon-text-faint text-xs mb-2">
          {privacyUrl && (
            <Link href={privacyUrl} className="neon-text-muted underline">
              {copy.privacyPolicy[language]}
            </Link>
          )}
          {privacyUrl && termsUrl && " · "}
          {termsUrl && (
            <Link href={termsUrl} className="neon-text-muted underline">
              {copy.termsOfService[language]}
            </Link>
          )}
        </Text>
      )}
      <Text className="neon-text-faint text-xs">
        <Ltr>© {currentYear}</Ltr> {copy.copyrightLabel[language]}
      </Text>
    </Section>
  );
}
