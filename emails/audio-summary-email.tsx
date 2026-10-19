import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface AudioSummaryEmailProps {
  language: Language;
  audioUrl?: string;
}

const content = {
  ar: {
    preview: "الملخص الصوتي جاهز على منصة نيون",
    heading: "الملخص الصوتي جاهز! 🎧",
    body: "مرحبًا، يسرنا إبلاغك بأنه تم الانتهاء من إعداد الملخص الصوتي الخاص بدرسك. يمكنك الآن الاستماع إليه في أي وقت ومن أي مكان.",
    button: "استمع للملخص الآن",
  },
  en: {
    preview: "Your audio summary is ready on Neon",
    heading: "Your audio summary is ready! 🎧",
    body: "Hi, we're happy to let you know your lesson's audio summary is ready. You can now listen to it anytime, anywhere.",
    button: "Listen now",
  },
} as const;

function AudioSummaryEmail({
  language,
  audioUrl = "https://neonedu.org/audio-summary",
}: AudioSummaryEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-8 leading-relaxed">{c.body}</Text>
      <PrimaryButton href={audioUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

AudioSummaryEmail.PreviewProps = {
  language: "ar",
} satisfies AudioSummaryEmailProps;

export default AudioSummaryEmail;
