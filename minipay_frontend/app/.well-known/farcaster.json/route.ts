import { headers } from "next/headers";
import { getMinikitConfig } from "../../../minikit.config";
import { resolveSiteUrl } from "@/lib/siteUrl";

async function requestBaseUrl(): Promise<string | undefined> {
  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) return undefined;
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  return resolveSiteUrl(`${proto}://${host}`);
}

export async function GET() {
  const baseUrl = await requestBaseUrl();
  return Response.json(getMinikitConfig(baseUrl));
}
