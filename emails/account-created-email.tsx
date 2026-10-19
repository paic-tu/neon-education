import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface AccountCreatedEmailProps {
  language: Language;
  userName?: string;
  dashboardUrl?: string;
}

const content = {
  ar: {
    preview: "تم إنشاء حسابك في منصة نيون التعليمية بنجاح",
    heading: "مرحبًا بك في منصة نيوَن التعليمية",
    body: "يسعدنا انضمامك إلينا. أصبح حسابك جاهزًا الآن، ويمكنك البدء في استكشاف المنصة والاستفادة من خدماتها لتطوير مهاراتك التقنية والوصول إلى هدفك.",
    button: "البدء الآن",
  },
  en: {
    preview: "Your Neon Educational Platform account was created",
    heading: "Welcome to Neon Educational Platform",
    body: "We're glad you joined us. Your account is now ready, and you can start exploring the platform to build your skills and reach your goals.",
    button: "Get started",
  },
} as const;

function AccountCreatedEmail({
  language,
  userName,
  dashboardUrl = "https://neonedu.org/dashboard",
}: AccountCreatedEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">
        {userName ? (language === "ar" ? `مرحبًا ${userName}!` : `Welcome, ${userName}!`) : c.heading}
      </Text>
      <Text className="neon-text mb-8 leading-relaxed">{c.body}</Text>
      <PrimaryButton href={dashboardUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

AccountCreatedEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
} satisfies AccountCreatedEmailProps;

export default AccountCreatedEmail;
