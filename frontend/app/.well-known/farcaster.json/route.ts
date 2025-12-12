import { NextResponse } from "next/server";

export async function GET() {
  const farcasterHostedManifest =
    "https://api.farcaster.xyz/miniapps/hosted-manifest/019b13c3-d4cd-eaac-a018-d241e391fe0c";

  // Send a 307 Temporary Redirect
  return NextResponse.redirect(farcasterHostedManifest, 307);
}
