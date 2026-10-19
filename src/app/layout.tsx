import type { Metadata } from "next";
import "./globals.css";
import "./product.css";
import "./motion.css";
import { Open_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { AnalyticsBeacon } from "@/components/analytics-beacon";

const rilSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${rilSans.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <ToastProvider>
          <AnalyticsBeacon />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
