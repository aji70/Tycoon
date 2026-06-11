"use client";

import { useMediaQuery } from "@/components/useMediaQuery";
import NavBar from "@/components/shared/navbar";
import NavBarMobile from "@/components/shared/navbar-mobile";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import { ProfileProvider } from "@/context/ProfileContext";
import AuthGuard from "@/components/auth/AuthGuard";

interface ClientLayoutProps {
  children: ReactNode;
  cookies?: string | null;
}

export default function ClientLayout({ children, cookies }: ClientLayoutProps) {
  const [navReady, setNavReady] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const pathname = usePathname();
  const isBoard3DMobile = pathname === "/board-3d-mobile" || pathname === "/board-3d-multi-mobile";
  const isHome = pathname === "/";
  const needsMobileNavPadding = isMobile && !isBoard3DMobile && !isHome;

  useEffect(() => {
    setNavReady(true);
  }, []);

  return (
    <ProfileProvider>
      <div
        suppressHydrationWarning
        className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}
      >
        {navReady ? (isMobile ? <NavBarMobile minimal={isBoard3DMobile} /> : <NavBar />) : null}
        <AuthGuard>
          <div className={needsMobileNavPadding ? "pt-below-mobile-nav" : undefined}>
            {children}
          </div>
        </AuthGuard>
      </div>
    </ProfileProvider>
  );
}
