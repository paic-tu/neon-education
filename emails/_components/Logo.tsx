import { Img, Section } from "@react-email/components";
import * as React from "react";

interface LogoProps {
  logoUrl?: string;
  size?: number;
  alt?: string;
}

export function Logo({
  logoUrl = "https://i.imgur.com/a11HzDS.png",
  size = 72,
  alt = "Neon",
}: LogoProps) {
  return (
    <Section className="mb-6 text-center">
      <Img
        src={logoUrl}
        width={size}
        height={size}
        alt={alt}
        style={{
          borderRadius: 9999,
          display: "block",
          margin: "0 auto",
          objectFit: "contain",
        }}
      />
    </Section>
  );
}
