import { syne, jetbrainsMono } from "@/components/shared/fonts-arena";

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${syne.variable} ${jetbrainsMono.variable}`}>{children}</div>;
}
