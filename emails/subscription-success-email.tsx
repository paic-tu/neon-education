import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import { FallbackLink } from "./_components/FallbackLink";
import { Ltr } from "./_components/Bidi";
import type { Language } from "./_lib/types";

export interface PaymentReceiptDetails {
  userName: string;
  orderId: string;
  amount: string;
  paidAt: string;
  method: string;
  items: { name: string; quantity: number; price: string }[];
  isEvent: boolean;
  ticketCount: number;
}

interface SubscriptionSuccessEmailProps {
  language: Language;
  planName?: string;
  dashboardUrl?: string;
  receipt?: PaymentReceiptDetails;
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
  receipt,
}: SubscriptionSuccessEmailProps) {
  const c = content[language];
  const isAr = language === "ar";
  if (receipt) {
    return (
      <EmailLayout language={language} preview={isAr ? "تم تأكيد الدفع لطلبك في نيون" : "Your Neon order payment is confirmed"}>
        <Text className="text-2xl font-bold mb-4 neon-heading">{isAr ? "تم تأكيد الدفع بنجاح" : "Payment confirmed"}</Text>
        <Text className="neon-text mb-4 leading-relaxed">
          {isAr ? `مرحباً ${receipt.userName}، تم تأكيد طلبك في منصة نيون التعليمية.` : `Hi ${receipt.userName}, your Neon order is confirmed.`}
        </Text>
        <Text className="neon-text text-sm leading-relaxed">
          {isAr ? "رقم الطلب:" : "Order:"} <Ltr>{receipt.orderId}</Ltr><br />
          {isAr ? "المبلغ:" : "Amount:"} {receipt.amount}<br />
          {isAr ? "تاريخ التأكيد (السعودية):" : "Confirmed (Saudi Arabia):"} {receipt.paidAt}<br />
          {isAr ? "طريقة التأكيد:" : "Payment method:"} {receipt.method}
        </Text>
        {receipt.items.map((item, index) => (
          <Text key={index} className="neon-text text-sm leading-relaxed">
            {item.name} × {item.quantity}<br />
            {isAr ? "سعر الوحدة:" : "Unit price:"} {item.price} {isAr ? "ريال" : "SAR"}
          </Text>
        ))}
        {receipt.isEvent && (
          <Text className="neon-text text-sm mb-6">
            {isAr ? `عدد تذاكر الفعالية: ${receipt.ticketCount}. الباركود الخاص بكل تذكرة متاح داخل نيون.` : `Event tickets: ${receipt.ticketCount}. Each ticket barcode is available inside Neon.`}
          </Text>
        )}
        <PrimaryButton href={dashboardUrl}>
          {receipt.isEvent ? (isAr ? "عرض تذاكري والباركود" : "View my tickets and barcodes") : (isAr ? "عرض طلباتي" : "View my orders")}
        </PrimaryButton>
        <FallbackLink language={language} url={dashboardUrl} />
        <Text className="neon-text-muted text-sm mt-6 leading-relaxed">
          {receipt.isEvent
            ? (isAr ? "يتطلب الرابط تسجيل الدخول بالحساب الذي اشترى التذاكر. لا تشارك الباركود؛ كل تذكرة تسمح بدخول واحد فقط." : "Sign in with the purchasing account. Keep your barcode private; each ticket permits one admission.")
            : (isAr ? "يمكنك مراجعة تفاصيل الطلب بعد تسجيل الدخول إلى حسابك في نيون." : "Sign in to your Neon account to view your order details.")}
        </Text>
      </EmailLayout>
    );
  }
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
