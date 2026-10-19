import { Link, Text } from "@react-email/components";
import * as React from "react";
import { copy } from "../_lib/copy";
import type { Language } from "../_lib/types";
import { Ltr } from "./Bidi";

interface FallbackLinkProps {
  language: Language;
  url: string;
}

export function FallbackLink({ language, url }: FallbackLinkProps) {
  return (
    <Text className="neon-text-faint text-xs mt-4 break-all">
      {copy.fallbackLinkIntro[language]}
      <br />
      <Ltr>
        <Link href={url} className="neon-link underline">
          {url}
        </Link>
      </Ltr>
    </Text>
  );
}
