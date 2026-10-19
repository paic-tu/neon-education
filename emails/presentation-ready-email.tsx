import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface PresentationReadyEmailProps {
  language: Language;
  userName?: string;
  presentationUrl?: string;
}

const content = {
  ar: {
    preview: "العرض التقديمي جاهز على منصة نيون",
    heading: "العرض التقديمي جاهز 📊",
    greeting: (name?: string) => (name ? `أهلاً بك يا ${name}،` : "أهلاً بك،"),
    body1: "يسعدنا إعلامك بأن النظام انتهى من تصميم وتجهيز العرض التقديمي، وأصبح جاهزاً الآن للمراجعة أو التحميل.",
    body2: "يمكنك معاينة الشرائح أو تحميلها مباشرة من حسابك.",
    button: "معاينة العرض التقديمي",
  },
  en: {
    preview: "Your presentation is ready on Neon",
    heading: "Your presentation is ready 📊",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body1: "We're happy to let you know your presentation has been designed and is now ready for review or download.",
    body2: "You can preview the slides or download them directly from your account.",
    button: "Preview presentation",
  },
} as const;

function PresentationReadyEmail({
  language,
  userName,
  presentationUrl = "https://neonedu.org/presentation",
}: PresentationReadyEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-6 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body1}
      </Text>
      <Text className="neon-text-muted text-sm mb-8 leading-relaxed">{c.body2}</Text>
      <PrimaryButton href={presentationUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

PresentationReadyEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
} satisfies PresentationReadyEmailProps;

export default PresentationReadyEmail;
