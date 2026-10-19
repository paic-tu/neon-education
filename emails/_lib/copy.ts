import type { Language } from "./types";

export const copy = {
  contactUs: {
    ar: "تواصل معنا",
    en: "Contact us",
  },
  copyrightLabel: {
    ar: "منصة نيون التعليمية",
    en: "Neon Educational Platform",
  },
  needHelp: {
    ar: "تحتاج مساعدة؟ راسلنا على",
    en: "Need help? Reach us at",
  },
  fallbackLinkIntro: {
    ar: "إذا لم يعمل الزر أعلاه، انسخ هذا الرابط والصقه في متصفحك:",
    en: "If the button above doesn't work, copy and paste this link into your browser:",
  },
  securityNoticeExpiring: {
    ar: {
      before: "صالح لمدة",
      after: "دقيقة ويُستخدم مرة واحدة فقط. إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذه الرسالة بأمان.",
    },
    en: {
      before: "This is valid for",
      after: "minutes and can only be used once. If you didn't request this, you can safely ignore this email.",
    },
  },
  securityNoticeGeneric: {
    ar: "إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذه الرسالة بأمان.",
    en: "If you didn't request this, you can safely ignore this email.",
  },
  privacyPolicy: {
    ar: "سياسة الخصوصية",
    en: "Privacy Policy",
  },
  termsOfService: {
    ar: "الشروط والأحكام",
    en: "Terms of Service",
  },
} as const;

export function t(entry: { ar: string; en: string }, language: Language): string {
  return entry[language];
}
