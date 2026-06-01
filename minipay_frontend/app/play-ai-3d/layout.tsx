/** AI 3D settings use wagmi; skip static prerender. */
export const dynamic = "force-dynamic";

export default function PlayAI3DLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
