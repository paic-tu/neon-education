import { Text } from "@react-email/components";
import * as React from "react";
import { copy } from "../_lib/copy";
import type { Language } from "../_lib/types";
import { Ltr } from "./Bidi";

interface SecurityNoticeProps {
  language: Language;
  expirationMinutes?: number;
}

export function SecurityNotice({ language, expirationMinutes }: SecurityNoticeProps) {
  if (expirationMinutes == null) {
    return (
      <Text className="neon-text-muted text-sm mt-6">
        {copy.securityNoticeGeneric[language]}
      </Text>
    );
  }

  const { before, after } = copy.securityNoticeExpiring[language];
  return (
    <Text className="neon-text-muted text-sm mt-6">
      {before} <Ltr>{expirationMinutes}</Ltr> {after}
    </Text>
  );
}
