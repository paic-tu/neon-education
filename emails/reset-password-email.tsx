import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { FallbackLink } from "./_components/FallbackLink";
import { PrimaryButton } from "./_components/PrimaryButton";
import { SecurityNotice } from "./_components/SecurityNotice";
import type { Language } from "./_lib/types";

interface ResetPasswordEmailProps {
  language: Language;
  resetPasswordUrl: string;
  userName?: string;
  expirationMinutes?: number;
}

const content = {
  ar: {
    preview: "إعادة تعيين كلمة المرور لحسابك في منصة نيون",
    heading: "استعادة كلمة المرور",
    greeting: (name?: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    body: "تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لإنشاء كلمة مرور جديدة.",
    button: "إعادة تعيين كلمة المرور",
  },
  en: {
    preview: "Reset your Neon account password",
    heading: "Reset your password",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body: "We received a request to reset your account password. Click the button below to set a new one.",
    button: "Reset password",
  },
} as const;

function ResetPasswordEmail({
  language,
  resetPasswordUrl,
  userName,
  expirationMinutes,
}: ResetPasswordEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body}
      </Text>
      <PrimaryButton href={resetPasswordUrl}>{c.button}</PrimaryButton>
      <SecurityNotice language={language} expirationMinutes={expirationMinutes} />
      <FallbackLink language={language} url={resetPasswordUrl} />
    </EmailLayout>
  );
}

ResetPasswordEmail.PreviewProps = {
  language: "ar",
  resetPasswordUrl: "https://neonedu.org/reset-password?token=abc123",
  userName: "مازن",
  expirationMinutes: 15,
} satisfies ResetPasswordEmailProps;

export default ResetPasswordEmail;
