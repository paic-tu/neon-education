import { Section, Text } from "@react-email/components";
import * as React from "react";
import { Ltr } from "./Bidi";

interface VerificationCodeProps {
  code: string;
}

export function VerificationCode({ code }: VerificationCodeProps) {
  return (
    <Section className="my-4">
      <div
        style={{ backgroundColor: "#5A5FE8" }}
        className="inline-block py-3 px-6 text-center"
      >
        <Text
          className="text-2xl font-bold tracking-widest m-0"
          style={{ color: "#ffffff" }}
        >
          <Ltr>{code}</Ltr>
        </Text>
      </div>
    </Section>
  );
}
