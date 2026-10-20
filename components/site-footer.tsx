"use client"

import { useLanguage } from "@/lib/language-context"
import { Linkedin } from "lucide-react"
import { PaymentMethodIcons } from "./payment-methods-section"

export function SiteFooter() {
  const { language } = useLanguage()
  const isAr = language === "ar"

  return (
    <footer className="relative z-10 border-t py-12 bg-muted mt-auto">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {isAr ? "منصة نيون التعليمية" : "Neon Learning Platform"}
          </div>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "© 2025 منصة نيون التعليمية. جميع الحقوق محفوظة."
              : "© 2025 Neon Learning Platform. All rights reserved."}
          </p>
          <div className="flex justify-center gap-4 text-sm text-muted-foreground mt-4 flex-wrap">
            <a href={`/${language}/privacy`} className="hover:text-primary transition-colors">
              {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
            </a>
            <a href={`/${language}/terms`} className="hover:text-primary transition-colors">
              {isAr ? "شروط الاستخدام" : "Terms of Use"}
            </a>
            <a href={`/${language}/content-policy`} className="hover:text-primary transition-colors">
              {isAr ? "سياسة المحتوى" : "Content Policy"}
            </a>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mt-6">
            <div className="flex flex-col items-center md:items-start">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground/85 font-bold text-center md:text-start">
                {isAr ? "طرق الدفع المدعومة" : "Secure Payment Methods"}
              </div>
              <PaymentMethodIcons className="justify-center md:justify-start" />
            </div>
            <div className="flex flex-col items-center md:items-end">
              <div className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground/85 font-bold text-center md:text-start">
                {isAr ? "تواصل معنا" : "Follow Us"}
              </div>
              <div className="flex justify-center items-center gap-4">
                <a
                  href="https://www.linkedin.com/company/neon-edu-sa/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background/50 text-muted-foreground shadow-sm hover:-translate-y-0.5 hover:border-indigo-400 hover:text-[#0A66C2] hover:shadow-lg hover:shadow-[#0A66C2]/20 transition-all duration-200"
                >
                  <Linkedin className="h-5 w-5" strokeWidth={2.2} />
                </a>
                <a
                  href="https://x.com/eduneonsa?s=21"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X / Twitter"
                  title="X / Twitter"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background/50 text-muted-foreground shadow-sm hover:-translate-y-0.5 hover:border-slate-700 dark:hover:border-slate-300 hover:text-foreground hover:shadow-lg transition-all duration-200"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                    <path d="M18.244 2H21.5l-7.19 8.214L23 22h-6.93l-4.68-6.128L5.8 22H2.54l7.68-8.78L1.5 2h7.08l4.23 5.582L18.244 2Zm-2.42 18h1.92L7.29 4H5.26l10.564 16Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/75 font-medium text-center">
            {isAr
              ? "🔒 جميع عمليات الدفع مشفرة ومأمنة بالكامل — مدعوم بوابة Stream Pay"
              : "🔒 All payments are fully encrypted and secured — Powered by Stream Pay Gateway"}
          </p>
        </div>
      </div>
    </footer>
  )
}
