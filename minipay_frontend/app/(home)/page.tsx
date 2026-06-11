import HomeClient from "@/clients/HomeClient";
import HeroLcpShell from "@/components/hero/HeroLcpShell";

export default function Home() {
  return (
    <>
      <HeroLcpShell />
      <HomeClient />
    </>
  );
}
