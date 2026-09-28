import { InstallBanner } from "@/components/InstallBanner";

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InstallBanner />
      <main className="col">{children}</main>
    </>
  );
}
