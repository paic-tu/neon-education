import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface PaymentFailedEmailProps {
  language: Language;
  userName?: string;
  planName?: string;
  billingUrl?: string;
}

const content = {
  ar: {
    preview: "تنبيه: فشل تجديد اشتراكك في منصة نيون",
    heading: "تعذر معالجة الدفع 💳",
    greeting: (name?: string) => (name ? `عزيزي ${name}،` : "عزيزي المستخدم،"),
    body: (plan: string) =>
      `حاولنا تجديد اشتراكك في "${plan}" تلقائياً، ولكن لم تتمكن عملية الدفع من المرور بنجاح. لضمان عدم توقف خدماتك، يرجى تحديث بيانات بطاقتك الائتمانية.`,
    noticeBox: "يرجى تحديث وسيلة الدفع لتجنب إلغاء مميزات الباقة قريباً.",
    footer: "إذا واجهت أي مشكلة، فريق الدعم الفني جاهز لمساعدتك دائماً.",
    button: "تحديث بيانات الدفع",
    defaultPlan: "باقتك",
  },
  en: {
    preview: "Payment failed for your Neon subscription",
    heading: "Payment failed 💳",
    greeting: (name?: string) => (name ? `Dear ${name},` : "Dear user,"),
    body: (plan: string) =>
      `We tried to automatically renew your "${plan}" subscription, but the payment couldn't go through. To keep your services running, please update your card details.`,
    noticeBox: "Please update your payment method to avoid losing your plan's features soon.",
    footer: "If you run into any issue, our support team is always ready to help.",
    button: "Update payment details",
    defaultPlan: "your plan",
  },
} as const;

function PaymentFailedEmail({
  language,
  userName,
  planName,
  billingUrl = "https://neonedu.org/billing",
}: PaymentFailedEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-danger-heading">{c.heading}</Text>
      <Text className="neon-text mb-4 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body(planName ?? c.defaultPlan)}
      </Text>

      <Section className="neon-danger-box my-6 p-4 rounded-md text-center border">
        <Text className="neon-danger-text text-sm m-0">{c.noticeBox}</Text>
      </Section>

      <PrimaryButton href={billingUrl}>{c.button}</PrimaryButton>

      <Text className="neon-text-faint text-xs mt-6 leading-relaxed">{c.footer}</Text>
    </EmailLayout>
  );
}

PaymentFailedEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
  planName: "الباقة الشاملة",
} satisfies PaymentFailedEmailProps;

export default PaymentFailedEmail;
