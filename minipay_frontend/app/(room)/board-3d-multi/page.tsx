"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Board3DMultiPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const gameCode = searchParams.get("gameCode");
    router.replace(
      gameCode
        ? `/board-3d-multi-mobile?gameCode=${encodeURIComponent(gameCode)}`
        : "/board-3d-multi-mobile"
    );
  }, [router, searchParams]);

  return null;
}
