import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface ErrorAlertEmailProps {
  language: Language;
  supportUrl?: string;
}

const content = {
  ar: {
    preview: "حدث خطأ أثناء تنفيذ عملية على منصة نيون",
    heading: "حدث خطأ أثناء تنفيذ العملية ⚠️",
    body1: "عذراً، واجهنا مشكلة تقنية غير متوقعة أثناء معالجة طلبك الأخير.",
    body2: "يرجى المحاولة مرة أخرى لاحقاً، أو التواصل مع فريق الدعم إذا استمرت المشكلة.",
    button: "التواصل مع الدعم",
  },
  en: {
    preview: "An error occurred while processing your request on Neon",
    heading: "An error occurred ⚠️",
    body1: "Sorry, we ran into an unexpected technical issue while processing your last request.",
    body2: "Please try again later, or contact our support team if the problem persists.",
    button: "Contact support",
  },
} as const;

function ErrorAlertEmail({
  language,
  supportUrl = "https://neonedu.org/support",
}: ErrorAlertEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">{c.body1}</Text>
      <Text className="neon-text-muted text-sm mb-8 leading-relaxed">{c.body2}</Text>
      <PrimaryButton href={supportUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

ErrorAlertEmail.PreviewProps = {
  language: "ar",
} satisfies ErrorAlertEmailProps;

export default ErrorAlertEmail;
