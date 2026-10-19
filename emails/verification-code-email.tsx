import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { SecurityNotice } from "./_components/SecurityNotice";
import { VerificationCode } from "./_components/VerificationCode";
import type { Language } from "./_lib/types";

interface VerificationCodeEmailProps {
  language: Language;
  verificationCode: string;
  userName?: string;
  expirationMinutes?: number;
}

const content = {
  ar: {
    preview: "رمز التحقق الخاص بك في منصة نيون",
    heading: "رمز التحقق الخاص بك",
    greeting: (name?: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    body: "استخدم رمز التحقق التالي لإكمال العملية:",
  },
  en: {
    preview: "Your Neon verification code",
    heading: "Your verification code",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body: "Use the verification code below to complete your request:",
  },
} as const;

function VerificationCodeEmail({
  language,
  verificationCode,
  userName,
  expirationMinutes,
}: VerificationCodeEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body}
      </Text>
      <VerificationCode code={verificationCode} />
      <SecurityNotice language={language} expirationMinutes={expirationMinutes} />
    </EmailLayout>
  );
}

VerificationCodeEmail.PreviewProps = {
  language: "ar",
  verificationCode: "482913",
  userName: "مازن",
  expirationMinutes: 10,
} satisfies VerificationCodeEmailProps;

export default VerificationCodeEmail;
