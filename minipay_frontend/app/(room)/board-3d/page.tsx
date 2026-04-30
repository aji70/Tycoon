"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Board3DPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const gameCode = searchParams.get("gameCode");
    router.replace(
      gameCode
        ? `/board-3d-mobile?gameCode=${encodeURIComponent(gameCode)}`
        : "/board-3d-mobile"
    );
  }, [router, searchParams]);

  return null;
}
