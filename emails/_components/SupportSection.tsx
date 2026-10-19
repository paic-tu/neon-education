import { Link, Text } from "@react-email/components";
import * as React from "react";
import { copy } from "../_lib/copy";
import type { Language } from "../_lib/types";
import { Ltr } from "./Bidi";

interface SupportSectionProps {
  language: Language;
  supportEmail?: string;
}

export function SupportSection({
  language,
  supportEmail = "support@neonedu.org",
}: SupportSectionProps) {
  return (
    <Text className="neon-text-muted text-sm mt-4">
      {copy.needHelp[language]}{" "}
      <Ltr>
        <Link href={`mailto:${supportEmail}`} className="neon-link underline">
          {supportEmail}
        </Link>
      </Ltr>
    </Text>
  );
}
