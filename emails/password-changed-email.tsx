import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { SupportSection } from "./_components/SupportSection";
import type { Language } from "./_lib/types";

interface PasswordChangedEmailProps {
  language: Language;
  userName?: string;
  supportEmail?: string;
}

const content = {
  ar: {
    preview: "تم تغيير كلمة المرور الخاصة بحسابك في منصة نيون",
    heading: "تم تغيير كلمة المرور",
    greeting: (name?: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    body: "تم تغيير كلمة المرور الخاصة بحسابك بنجاح.",
    warning: "إذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل مع الدعم فوراً لتأمين حسابك.",
  },
  en: {
    preview: "Your Neon account password was changed",
    heading: "Your password was changed",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body: "Your account password was changed successfully.",
    warning: "If you didn't make this change, please contact support immediately to secure your account.",
  },
} as const;

function PasswordChangedEmail({
  language,
  userName,
  supportEmail,
}: PasswordChangedEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-4 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body}
      </Text>
      <Text className="neon-text-muted text-sm mb-4">{c.warning}</Text>
      <SupportSection language={language} supportEmail={supportEmail} />
    </EmailLayout>
  );
}

PasswordChangedEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
} satisfies PasswordChangedEmailProps;

export default PasswordChangedEmail;
