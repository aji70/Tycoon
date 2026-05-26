"use client"; // ← Mark as client component

import { useMediaQuery } from "@/components/useMediaQuery"; // Your custom hook
import NavBar from "@/components/shared/navbar";
import NavBarMobile from "@/components/shared/navbar-mobile";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts"; // Adjust path if needed
import { ProfileProvider } from "@/context/ProfileContext";
import AuthGuard from "@/components/auth/AuthGuard";

interface ClientLayoutProps {
  children: ReactNode;
  cookies?: string | null;
  /** Homepage before wallet providers mount — skip nav that requires wagmi/Privy. */
  minimal?: boolean;
}

export default function ClientLayout({ children, minimal = false }: ClientLayoutProps) {
  const [isClient, setIsClient] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const pathname = usePathname();
  const isBoard3DMobile = pathname === "/board-3d-mobile" || pathname === "/board-3d-multi-mobile";
  const isAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (minimal) {
    return <>{children}</>;
  }

  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <ProfileProvider>
      <div suppressHydrationWarning>
        {!isAdmin && (isMobile ? <NavBarMobile minimal={isBoard3DMobile} /> : <NavBar />)}
        <AuthGuard>{children}</AuthGuard>
      </div>
    </ProfileProvider>
  );
}