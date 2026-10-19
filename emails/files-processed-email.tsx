import { Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface FilesProcessedEmailProps {
  language: Language;
  filesUrl?: string;
}

const content = {
  ar: {
    preview: "تمت معالجة ملفاتك بنجاح على منصة نيون",
    heading: "تمت معالجة ملفاتك بنجاح",
    body: "مرحبًا، يسرنا إبلاغك بأن جميع الملفات التي قمت برفعها قد تم معالجتها بالكامل وهي الآن جاهزة للاستخدام في منصة نيوَن التعليمية.",
    button: "استعراض الملفات",
  },
  en: {
    preview: "Your files were processed successfully on Neon",
    heading: "Your files were processed",
    body: "Hi, we're happy to let you know all the files you uploaded have been fully processed and are now ready to use on Neon Educational Platform.",
    button: "View files",
  },
} as const;

function FilesProcessedEmail({
  language,
  filesUrl = "https://neonedu.org/my-files",
}: FilesProcessedEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-8 leading-relaxed">{c.body}</Text>
      <PrimaryButton href={filesUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

FilesProcessedEmail.PreviewProps = {
  language: "ar",
} satisfies FilesProcessedEmailProps;

export default FilesProcessedEmail;
