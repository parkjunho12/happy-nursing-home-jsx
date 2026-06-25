"use client";

import { usePathname } from "next/navigation";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileCTA from "@/components/layout/MobileCTA";
import CtaTrackingInit from "@/components/analytics/CtaTrackingInit";
import FloatingCTA from "@/components/analytics/FloatingCTA";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isCouncelPage = pathname.startsWith("/councel");

  return (
    <>
      <CtaTrackingInit />
      {!isCouncelPage && <Header />}

      <main className="min-h-screen">{children}</main>

      {!isCouncelPage && <FloatingCTA />}

      {!isCouncelPage && <Footer />}
      {!isCouncelPage && <MobileCTA />}
    </>
  );
}