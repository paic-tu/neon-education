import { Text } from "@react-email/components";
import * as React from "react";
import { Ltr } from "./_components/Bidi";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import { SupportSection } from "./_components/SupportSection";
import type { Language } from "./_lib/types";

interface LoginAlertEmailProps {
  language: Language;
  userName?: string;
  deviceName?: string;
  loginLocation?: string;
  loginTime?: string;
  securityUrl?: string;
  supportEmail?: string;
}

const content = {
  ar: {
    preview: "تنبيه: تسجيل دخول جديد إلى حسابك في منصة نيون",
    heading: "تنبيه: تسجيل دخول جديد",
    greeting: (name?: string) => (name ? `مرحبًا ${name}،` : "مرحبًا،"),
    body: "تم تسجيل الدخول إلى حسابك من جهاز أو موقع جديد.",
    device: "الجهاز",
    location: "الموقع",
    time: "الوقت",
    reassurance: "إذا كنت أنت من قام بتسجيل الدخول، فلا حاجة لاتخاذ أي إجراء.",
    warning:
      "أما إذا لم تتعرف على هذا النشاط، فننصحك بتغيير كلمة المرور فوراً.",
    button: "تأمين حسابي",
  },
  en: {
    preview: "New login alert for your Neon account",
    heading: "New login detected",
    greeting: (name?: string) => (name ? `Hi ${name},` : "Hi,"),
    body: "Your account was just signed in to from a new device or location.",
    device: "Device",
    location: "Location",
    time: "Time",
    reassurance: "If this was you, no action is needed.",
    warning:
      "If you don't recognize this activity, we recommend changing your password immediately.",
    button: "Secure my account",
  },
} as const;

function LoginAlertEmail({
  language,
  userName,
  deviceName,
  loginLocation,
  loginTime,
  securityUrl = "https://neonedu.org/security",
  supportEmail,
}: LoginAlertEmailProps) {
  const c = content[language];
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-4 leading-relaxed">
        {c.greeting(userName)}
        <br />
        {c.body}
      </Text>

      {(deviceName || loginLocation || loginTime) && (
        <Text className="neon-text text-sm mb-4 leading-relaxed text-start">
          {deviceName && (
            <>
              {c.device}: <Ltr>{deviceName}</Ltr>
              <br />
            </>
          )}
          {loginLocation && (
            <>
              {c.location}: <Ltr>{loginLocation}</Ltr>
              <br />
            </>
          )}
          {loginTime && (
            <>
              {c.time}: <Ltr>{loginTime}</Ltr>
            </>
          )}
        </Text>
      )}

      <Text className="neon-text-muted text-sm mb-2 leading-relaxed">
        {c.reassurance}
      </Text>
      <Text className="neon-text-muted text-sm mb-6 leading-relaxed">
        {c.warning}
      </Text>
      <PrimaryButton href={securityUrl}>{c.button}</PrimaryButton>
      <SupportSection language={language} supportEmail={supportEmail} />
    </EmailLayout>
  );
}

LoginAlertEmail.PreviewProps = {
  language: "ar",
  userName: "مازن",
  deviceName: "iPhone 15 Pro · Safari",
  loginLocation: "Riyadh, Saudi Arabia",
  loginTime: "2026-08-13 02:14",
} satisfies LoginAlertEmailProps;

export default LoginAlertEmail;
