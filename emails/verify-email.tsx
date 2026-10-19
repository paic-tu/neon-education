import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { FallbackLink } from "./_components/FallbackLink";
import { PrimaryButton } from "./_components/PrimaryButton";
import { SecurityNotice } from "./_components/SecurityNotice";
import type { Language } from "./_lib/types";

interface VerifyEmailProps {
  language: Language;
  verificationUrl: string;
  userName?: string;
  expirationMinutes?: number;
}

const content = {
  ar: {
    preview: "أكّد بريدك الإلكتروني لتفعيل حسابك في منصة نيون",
    heading: "التحقق من البريد الإلكتروني",
    greeting: (name?: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    body: "شكرًا لانضمامك إلى منصة نيون التعليمية. لتفعيل حسابك، يرجى الضغط على الزر أدناه.",
    button: "تأكيد البريد الإلكتروني",
  },
  en: {
    preview: "Verify your email to activate your Neon account",
    heading: "Verify your email",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body: "Thanks for joining Neon Educational Platform. To activate your account, please click the button below.",
    button: "Verify email",
  },
} as const;

function VerifyEmail({
  language,
  verificationUrl,
  userName,
  expirationMinutes,
}: VerifyEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body}
      </Text>
      <PrimaryButton href={verificationUrl}>{c.button}</PrimaryButton>
      <SecurityNotice language={language} expirationMinutes={expirationMinutes} />
      <FallbackLink language={language} url={verificationUrl} />
    </EmailLayout>
  );
}

VerifyEmail.PreviewProps = {
  language: "ar",
  verificationUrl: "https://neonedu.org/verify?token=abc123",
  userName: "مازن",
  expirationMinutes: 30,
} satisfies VerifyEmailProps;

export default VerifyEmail;
