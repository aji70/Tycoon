"use client";

import { Suspense } from "react";
import ProfilePage from "@/components/profile/profile";
import ProfilePageMobile from "@/components/profile/profile-mobile";
import { useMediaQuery } from "@/components/useMediaQuery";
import VerifyEmailFromQuery from "@/components/auth/VerifyEmailFromQuery";

export default function ProfileClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      <Suspense fallback={null}>
        <VerifyEmailFromQuery />
      </Suspense>
      {isMobile ? <ProfilePageMobile /> : <ProfilePage />}
    </main>
  );
}