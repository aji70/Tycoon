/** Profile routes use wagmi hooks; skip static prerender. */
export const dynamic = "force-dynamic";

export default function ProfileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
