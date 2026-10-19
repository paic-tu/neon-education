import * as React from "react";
import { Logo } from "./Logo";

interface EmailHeaderProps {
  logoUrl?: string;
}

export function EmailHeader({ logoUrl }: EmailHeaderProps) {
  return <Logo logoUrl={logoUrl} />;
}
