import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface WelcomeEmailProps {
  language: Language;
  userName?: string;
  dashboardUrl?: string;
}

const content = {
  ar: {
    preview: "أهلاً بك في منصة نيون التعليمية — بداية رحلتك تبدأ من هنا!",
    heading: (name?: string) => (name ? `مرحبًا بك يا ${name}!` : "مرحبًا بك في منصة نيون التعليمية"),
    body1:
      "يسعدنا جداً انضمامك إلينا في منصة نيون. أصبح حسابك الآن جاهزاً بالكامل، وأصبحت بوابتك لعالم المعرفة مفتوحة.",
    body2: "سواء كنت هنا لتطوير مهاراتك أو لبدء رحلة تعلم جديدة، فريقنا هنا لدعمك في كل خطوة.",
    button: "استكشف المنصة الآن",
  },
  en: {
    preview: "Welcome to Neon Educational Platform — your journey starts here!",
    heading: (name?: string) => (name ? `Welcome, ${name}!` : "Welcome to Neon Educational Platform"),
    body1:
      "We're thrilled to have you join Neon. Your account is fully set up, and your gateway to knowledge is now open.",
    body2:
      "Whether you're here to build new skills or start a fresh learning journey, our team is with you every step of the way.",
    button: "Explore the platform",
  },
} as const;

function WelcomeEmail({
  language,
  userName,
  dashboardUrl = "https://neonedu.org/dashboard",
}: WelcomeEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading(userName)}</Text>
      <Text className="neon-text mb-4 leading-relaxed">{c.body1}</Text>
      <Text className="neon-text-muted text-sm mb-8 leading-relaxed">{c.body2}</Text>
      <PrimaryButton href={dashboardUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
  dashboardUrl: "https://neonedu.org/dashboard",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
