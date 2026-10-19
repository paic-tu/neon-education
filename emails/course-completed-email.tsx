import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface CourseCompletedEmailProps {
  language: Language;
  userName?: string;
  certificateUrl?: string;
}

const content = {
  ar: {
    preview: "هنيئاً لك اكتمال الكورس على منصة نيون",
    heading: "هنيئاً لك اكتمال الكورس! 🎓",
    greeting: (name?: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    body1: "لقد أتممت بنجاح جميع دروس ومحاور هذا الكورس على منصة نيوَن التعليمية. فخورون جداً برحلتك واجتهادك.",
    body2: "يمكنك الآن استعراض شهادة الإنجاز الخاصة بك أو الانتقال للمزيد من المسارات لتطوير مهاراتك.",
    button: "عرض الشهادة",
  },
  en: {
    preview: "Congratulations on completing your course on Neon",
    heading: "You completed your course! 🎓",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body1: "You've successfully completed every lesson and module in this course on Neon Educational Platform. We're proud of your dedication.",
    body2: "You can now view your certificate of completion or move on to more learning paths.",
    button: "View certificate",
  },
} as const;

function CourseCompletedEmail({
  language,
  userName,
  certificateUrl = "https://neonedu.org/certificate",
}: CourseCompletedEmailProps) {
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
      <PrimaryButton href={certificateUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

CourseCompletedEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
} satisfies CourseCompletedEmailProps;

export default CourseCompletedEmail;
