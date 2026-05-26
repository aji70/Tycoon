/** Remove the SSR hero shell once the interactive hero has mounted. */
export function dismissHeroLcpShell(): void {
  const el = document.getElementById("hero-lcp-shell");
  if (el) {
    el.remove();
  }
}
