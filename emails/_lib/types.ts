export type Language = "ar" | "en";

export interface TemplateVariables {
  userName?: string;
  verificationCode?: string;
  verificationUrl?: string;
  resetPasswordUrl?: string;
  expirationMinutes?: number;
  deviceName?: string;
  loginLocation?: string;
  supportEmail?: string;
  currentYear?: number;
}
