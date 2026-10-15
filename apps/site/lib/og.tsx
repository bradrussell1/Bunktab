import { ImageResponse } from "next/og";
import { palette, zebra as z } from "@bunktab/theme";
import { stripeLayout } from "@bunktab/core";
import { zebraDataUri } from "@/components/zebra/static";
import { ogFonts } from "@/lib/og-fonts";

export const OG_SIZE = { width: 1200, height: 630 };

const fonts = async () => ogFonts();

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Invite preview (design/reference/site/Preview.dc.html): volt, wordmark, inviter, big trip name, stripe meter, wink bust cropped bottom right. */
export async function inviteOg({ inviter, trip, members, done }: { inviter: string; trip: string; members: number; done: number }) {
  const name = truncate(trip, 28);
  const nameSize = name.length > 18 ? 72 : 104;
  const stripes = stripeLayout(members, done);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "64px 72px", background: palette.volt, color: palette.ink, fontFamily: "Figtree", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1, minWidth: 0, maxWidth: 740 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>zebrasplit</span>
          <div style={{ fontSize: 34, fontWeight: 600, display: "flex" }}>{`${truncate(inviter, 24)} invited you to`}</div>
          <div style={{ fontSize: nameSize, lineHeight: 0.95, fontWeight: 800, letterSpacing: -nameSize * 0.045, display: "flex", flexWrap: "wrap" }}>{name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, paddingTop: 6 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {stripes.map((st, i) => <span key={i} style={{ width: 26, height: 64, borderRadius: 13, background: z.ink, opacity: st.done ? 1 : 0.16 }} />)}
            </div>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{`${members} people · ${done} done`}</span>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={zebraDataUri({ variant: "bust", mood: "wink", size: 420 })} width={420} height={386} alt="" style={{ position: "absolute", right: 72, bottom: -120 }} />
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}

/** Default OG for every other page: same style, the tagline and the starry bust. */
export async function defaultOg() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "64px 72px", background: palette.volt, color: palette.ink, fontFamily: "Figtree", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1, maxWidth: 720 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>zebrasplit</span>
          <div style={{ fontSize: 92, lineHeight: 0.98, fontWeight: 800, letterSpacing: -4, display: "flex", flexDirection: "column" }}><span>Split the trip.</span><span>Not the friendship.</span></div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>Free. No expense limits.</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={zebraDataUri({ variant: "bust", mood: "starry", size: 420 })} width={420} height={386} alt="" style={{ position: "absolute", right: 72, bottom: -120 }} />
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
