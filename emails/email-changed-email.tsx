import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface EmailChangedEmailProps {
  language: Language;
  supportUrl?: string;
}

const content = {
  ar: {
    preview: "تم تحديث البريد الإلكتروني المرتبط بحسابك في منصة نيون",
    heading: "تغيير البريد الإلكتروني",
    body: "لقد تم بنجاح تحديث البريد الإلكتروني المرتبط بحسابك على منصة نيوَن التعليمية.",
    warning: "إذا لم تقم بهذا الإجراء أو واجهتك أي مشكلة، نرجو منك التواصل مع فريق الدعم فوراً لتأمين حسابك.",
    button: "التواصل مع الدعم",
  },
  en: {
    preview: "The email address on your Neon account was changed",
    heading: "Email address changed",
    body: "The email address associated with your Neon Educational Platform account was successfully updated.",
    warning: "If you didn't make this change or ran into any issue, please contact support immediately to secure your account.",
    button: "Contact support",
  },
} as const;

function EmailChangedEmail({
  language,
  supportUrl = "https://neonedu.org/support",
}: EmailChangedEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">{c.body}</Text>
      <Text className="neon-text-muted text-sm mb-8 leading-relaxed">{c.warning}</Text>
      <PrimaryButton href={supportUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

EmailChangedEmail.PreviewProps = {
  language: "ar",
} satisfies EmailChangedEmailProps;

export default EmailChangedEmail;
