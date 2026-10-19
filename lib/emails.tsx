"use server"

import * as React from "react"
import { render } from "@react-email/render"

import WelcomeEmail from "@/emails/welcome-email"
import AccountCreatedEmail from "@/emails/account-created-email"
import VerifyEmail from "@/emails/verify-email"
import VerificationCodeEmail from "@/emails/verification-code-email"
import ResetPasswordEmail from "@/emails/reset-password-email"
import PasswordChangedEmail from "@/emails/password-changed-email"
import EmailChangedEmail from "@/emails/email-changed-email"
import LoginAlertEmail from "@/emails/login-alert-email"
import SupportTicketEmail from "@/emails/support-ticket-email"
import PaymentFailedEmail from "@/emails/payment-failed-email"
import SubscriptionSuccessEmail from "@/emails/subscription-success-email"
import CourseCompletedEmail from "@/emails/course-completed-email"
import ErrorAlertEmail from "@/emails/error-alert-email"
import AudioSummaryEmail from "@/emails/audio-summary-email"
import FilesProcessedEmail from "@/emails/files-processed-email"
import PresentationReadyEmail from "@/emails/presentation-ready-email"

import type { Language } from "@/emails/_lib/types"

export type { Language }

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://neonedu.org"

async function renderEmail(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(element)
  const text = await render(element, { plainText: true })
  return { html, text }
}

export async function renderWelcomeEmail(props: {
  language: Language
  userName?: string
  dashboardUrl?: string
}) {
  return renderEmail(
    <WelcomeEmail
      language={props.language}
      userName={props.userName}
      dashboardUrl={props.dashboardUrl ?? `${baseUrl}/${props.language}/portal/dashboard`}
    />
  )
}

export async function renderAccountCreatedEmail(props: {
  language: Language
  userName?: string
  dashboardUrl?: string
}) {
  return renderEmail(
    <AccountCreatedEmail
      language={props.language}
      userName={props.userName}
      dashboardUrl={props.dashboardUrl ?? `${baseUrl}/${props.language}/portal/dashboard`}
    />
  )
}

export async function renderVerifyEmail(props: {
  language: Language
  verificationUrl: string
  userName?: string
  expirationMinutes?: number
}) {
  return renderEmail(
    <VerifyEmail
      language={props.language}
      verificationUrl={props.verificationUrl}
      userName={props.userName}
      expirationMinutes={props.expirationMinutes}
    />
  )
}

export async function renderVerificationCodeEmail(props: {
  language: Language
  verificationCode: string
  userName?: string
  expirationMinutes?: number
}) {
  return renderEmail(
    <VerificationCodeEmail
      language={props.language}
      verificationCode={props.verificationCode}
      userName={props.userName}
      expirationMinutes={props.expirationMinutes}
    />
  )
}

export async function renderResetPasswordEmail(props: {
  language: Language
  resetPasswordUrl: string
  userName?: string
  expirationMinutes?: number
}) {
  return renderEmail(
    <ResetPasswordEmail
      language={props.language}
      resetPasswordUrl={props.resetPasswordUrl}
      userName={props.userName}
      expirationMinutes={props.expirationMinutes}
    />
  )
}

export async function renderPasswordChangedEmail(props: {
  language: Language
  userName?: string
  supportEmail?: string
}) {
  return renderEmail(
    <PasswordChangedEmail
      language={props.language}
      userName={props.userName}
      supportEmail={props.supportEmail}
    />
  )
}

export async function renderEmailChangedEmail(props: {
  language: Language
  supportUrl?: string
}) {
  return renderEmail(
    <EmailChangedEmail
      language={props.language}
      supportUrl={props.supportUrl ?? `${baseUrl}/${props.language}/support`}
    />
  )
}

export async function renderLoginAlertEmail(props: {
  language: Language
  userName?: string
  deviceName?: string
  loginLocation?: string
  loginTime?: string
  securityUrl?: string
  supportEmail?: string
}) {
  return renderEmail(
    <LoginAlertEmail
      language={props.language}
      userName={props.userName}
      deviceName={props.deviceName}
      loginLocation={props.loginLocation}
      loginTime={props.loginTime}
      securityUrl={props.securityUrl ?? `${baseUrl}/${props.language}/portal/settings`}
      supportEmail={props.supportEmail}
    />
  )
}

export async function renderSupportTicketEmail(props: {
  language: Language
  ticketId?: string
  ticketUrl?: string
}) {
  return renderEmail(
    <SupportTicketEmail
      language={props.language}
      ticketId={props.ticketId}
      ticketUrl={props.ticketUrl ?? `${baseUrl}/${props.language}/portal/support`}
    />
  )
}

export async function renderPaymentFailedEmail(props: {
  language: Language
  userName?: string
  planName?: string
  billingUrl?: string
}) {
  return renderEmail(
    <PaymentFailedEmail
      language={props.language}
      userName={props.userName}
      planName={props.planName}
      billingUrl={props.billingUrl ?? `${baseUrl}/${props.language}/portal/billing`}
    />
  )
}

export async function renderSubscriptionSuccessEmail(props: {
  language: Language
  planName?: string
  dashboardUrl?: string
}) {
  return renderEmail(
    <SubscriptionSuccessEmail
      language={props.language}
      planName={props.planName}
      dashboardUrl={props.dashboardUrl ?? `${baseUrl}/${props.language}/portal/dashboard`}
    />
  )
}

export async function renderCourseCompletedEmail(props: {
  language: Language
  userName?: string
  certificateUrl?: string
}) {
  return renderEmail(
    <CourseCompletedEmail
      language={props.language}
      userName={props.userName}
      certificateUrl={props.certificateUrl ?? `${baseUrl}/${props.language}/portal/certificates`}
    />
  )
}

export async function renderErrorAlertEmail(props: {
  language: Language
  supportUrl?: string
}) {
  return renderEmail(
    <ErrorAlertEmail
      language={props.language}
      supportUrl={props.supportUrl ?? `${baseUrl}/${props.language}/support`}
    />
  )
}

export async function renderAudioSummaryEmail(props: {
  language: Language
  audioUrl?: string
}) {
  return renderEmail(
    <AudioSummaryEmail
      language={props.language}
      audioUrl={props.audioUrl ?? `${baseUrl}/${props.language}/portal`}
    />
  )
}

export async function renderFilesProcessedEmail(props: {
  language: Language
  filesUrl?: string
}) {
  return renderEmail(
    <FilesProcessedEmail
      language={props.language}
      filesUrl={props.filesUrl ?? `${baseUrl}/${props.language}/portal`}
    />
  )
}

export async function renderPresentationReadyEmail(props: {
  language: Language
  userName?: string
  presentationUrl?: string
}) {
  return renderEmail(
    <PresentationReadyEmail
      language={props.language}
      userName={props.userName}
      presentationUrl={props.presentationUrl ?? `${baseUrl}/${props.language}/portal`}
    />
  )
}
