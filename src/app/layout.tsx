import type { Metadata } from "next";
import "./globals.css";
import "./product.css";
import "./motion.css";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/toast";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { InputModality } from "@/components/ui/input-modality";
import "./ril-system.css";
import "./ril-brand.css";
import "./ril-theme.css";
import "./ril-refresh.css";

const rilSans = localFont({
  src: "../../public/fonts/open-sans-variable.ttf",
  weight: "300 800",
  style: "normal",
  variable: "--font-ril-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.renaissancelabs.org"),
  title: {
    default: "RIL Audience Intelligence",
    template: "%s · RIL Audience Intelligence",
  },
  description:
    "RIL's workspace for activities, audience learning, content, human approvals and campaign follow-up.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="ril-light-theme" suppressHydrationWarning>
      <body className={`${rilSans.variable} ril-light min-h-screen bg-background font-sans text-foreground antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <ToastProvider>
          <InputModality />
          <AnalyticsBeacon />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
