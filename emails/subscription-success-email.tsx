import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface SubscriptionSuccessEmailProps {
  language: Language;
  planName?: string;
  dashboardUrl?: string;
}

const content = {
  ar: {
    preview: "تم تفعيل اشتراكك في منصة نيون بنجاح",
    heading: "تم تفعيل اشتراكك بنجاح! 🎉",
    body1: (plan?: string) =>
      plan
        ? `مرحبًا، يسعدنا إبلاغك بأنه تم تأكيد عملية الدفع وتفعيل اشتراكك في "${plan}" بمنصة نيوَن التعليمية بنجاح.`
        : "مرحبًا، يسعدنا إبلاغك بأنه تم تأكيد عملية الدفع وتفعيل اشتراكك في منصة نيوَن التعليمية بنجاح.",
    body2: "يمكنك الآن الاستمتاع بكافة المزايا والمسارات التعليمية المتاحة في باقتك.",
    button: "الذهاب إلى لوحة التحكم",
  },
  en: {
    preview: "Your Neon subscription was activated",
    heading: "Your subscription is active! 🎉",
    body1: (plan?: string) =>
      plan
        ? `Hi, your payment was confirmed and your "${plan}" subscription on Neon Educational Platform is now active.`
        : "Hi, your payment was confirmed and your subscription on Neon Educational Platform is now active.",
    body2: "You can now enjoy all the features and learning paths included in your plan.",
    button: "Go to dashboard",
  },
} as const;

function SubscriptionSuccessEmail({
  language,
  planName,
  dashboardUrl = "https://neonedu.org/dashboard",
}: SubscriptionSuccessEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">{c.body1(planName)}</Text>
      <Text className="neon-text-muted text-sm mb-8 leading-relaxed">{c.body2}</Text>
      <PrimaryButton href={dashboardUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

SubscriptionSuccessEmail.PreviewProps = {
  language: "ar",
  planName: "الباقة الشاملة",
} satisfies SubscriptionSuccessEmailProps;

export default SubscriptionSuccessEmail;
