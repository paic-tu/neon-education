import { Column, Img, Link, Row, Section } from "@react-email/components";
import * as React from "react";

// Each icon is a flat 256x256 PNG (dark circle badge + glyph baked in,
// transparent corners) hosted on imgur — not inline SVG. Gmail strips
// inline <svg> content in many rendering paths, which is what produced
// empty gray circles before; hosted raster images render reliably.
const ICON_SIZE = 32;

function SocialIcon({
  href,
  imgUrl,
  label,
}: {
  href: string;
  imgUrl: string;
  label: string;
}) {
  return (
    <Column align="center" style={{ padding: "0 6px" }}>
      <Link href={href} aria-label={label}>
        <Img
          src={imgUrl}
          width={ICON_SIZE}
          height={ICON_SIZE}
          alt={label}
          style={{ display: "block", borderRadius: 9999 }}
        />
      </Link>
    </Column>
  );
}

interface SocialIconsProps {
  twitterUrl?: string;
  linkedinUrl?: string;
  whatsappUrl?: string;
  neonUrl?: string;
  logoUrl?: string;
}

export function SocialIcons({
  twitterUrl = "https://x.com/eduneonsa?s=11",
  linkedinUrl = "https://www.linkedin.com/company/neon-edu-sa/",
  whatsappUrl = "https://whatsapp.com/channel/0029VbC3cy2EKyZLlrRBPN3d",
  neonUrl = "http://neonedu.org/ar",
  logoUrl = "https://i.imgur.com/a11HzDS.png",
}: SocialIconsProps) {
  return (
    // className identifies this block so plain-text rendering can skip it
    // (icon-only links have no readable text — they'd otherwise collapse
    // into an unreadable run-on line of concatenated hrefs/labels; the
    // "contact us" link right below already covers plain-text reachability).
    <Section className="mb-4 social-icons-row">
      <Row style={{ width: "auto", margin: "0 auto" }}>
        <SocialIcon href={neonUrl} imgUrl={logoUrl} label="Neon" />
        <SocialIcon href={twitterUrl} imgUrl="https://i.imgur.com/9KNIHsY.png" label="X (Twitter)" />
        <SocialIcon href={linkedinUrl} imgUrl="https://i.imgur.com/6KyAtfi.png" label="LinkedIn" />
        <SocialIcon href={whatsappUrl} imgUrl="https://i.imgur.com/LU5oZ8f.png" label="WhatsApp" />
      </Row>
    </Section>
  );
}
