import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/Button";
import { Zebra } from "@/components/zebra";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "var(--zs-space-20)", padding: "72px var(--zs-space-24) 96px" }}>
        <Zebra variant="bust" mood="worried" size={160} label="Zebra, worried" />
        <h1 className="display">This page wandered off from the dazzle.</h1>
        <Button variant="ink" size="lg" href="/">Back home</Button>
      </main>
      <Footer />
    </>
  );
}
