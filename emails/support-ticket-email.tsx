import { Text } from "@react-email/components";
import * as React from "react";
import { Ltr } from "./_components/Bidi";
import { EmailLayout } from "./_components/EmailLayout";
import { PrimaryButton } from "./_components/PrimaryButton";
import type { Language } from "./_lib/types";

interface SupportTicketEmailProps {
  language: Language;
  ticketId?: string;
  ticketUrl?: string;
}

const content = {
  ar: {
    preview: "تلقينا طلب الدعم الخاص بك في منصة نيون",
    heading: "تلقينا طلب الدعم الخاص بك 🛠️",
    body1: "مرحبًا، لقد استلمنا رسالتك بنجاح وتم فتح تذكرة دعم جديدة لدى فريق خدمة العملاء في منصة نيوَن التعليمية.",
    body2: "نقوم حالياً بمراجعة طلبك وسيقوم أحد مختصي الدعم بالتواصل معك في أقرب وقت ممكن.",
    ticketLabel: "رقم التذكرة",
    button: "متابعة حالة التذكرة",
  },
  en: {
    preview: "We received your support request on Neon",
    heading: "We received your request 🛠️",
    body1: "Hi, we've successfully received your message and opened a new support ticket with our customer care team.",
    body2: "We're currently reviewing your request and a support specialist will reach out to you shortly.",
    ticketLabel: "Ticket number",
    button: "Track ticket status",
  },
} as const;

function SupportTicketEmail({
  language,
  ticketId,
  ticketUrl,
}: SupportTicketEmailProps) {
  const c = content[language];
  // The button promises to track *this* ticket — link to its specific
  // tracking page when we have an id, not the generic support page.
  const resolvedTicketUrl =
    ticketUrl ??
    (ticketId
      ? `https://neonedu.org/support/tickets/${encodeURIComponent(ticketId)}`
      : "https://neonedu.org/support");
  return (
    <EmailLayout language={language} preview={c.preview}>
      <Text className="text-2xl font-bold mb-4 neon-heading">{c.heading}</Text>
      <Text className="neon-text mb-4 leading-relaxed">{c.body1}</Text>
      {ticketId && (
        <Text className="neon-text text-sm mb-4">
          {c.ticketLabel}: <Ltr>{ticketId}</Ltr>
        </Text>
      )}
      <Text className="neon-text-muted text-sm mb-8 leading-relaxed">{c.body2}</Text>
      <PrimaryButton href={resolvedTicketUrl}>{c.button}</PrimaryButton>
    </EmailLayout>
  );
}

SupportTicketEmail.PreviewProps = {
  language: "ar",
  ticketId: "NEON-48213",
} satisfies SupportTicketEmailProps;

export default SupportTicketEmail;
