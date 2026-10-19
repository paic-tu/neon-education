import { Button } from "@react-email/components";
import * as React from "react";

interface PrimaryButtonProps {
  href: string;
  children: React.ReactNode;
}

export function PrimaryButton({ href, children }: PrimaryButtonProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: "#5A5FE8",
        borderRadius: "10px",
        padding: "12px 28px",
      }}
      className="text-white font-medium inline-block"
    >
      {children}
    </Button>
  );
}
