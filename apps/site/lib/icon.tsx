import { ImageResponse } from "next/og";
import { palette } from "@bunktab/theme";
import { zebraDataUri } from "@/components/zebra/static";

/** App icon: the happy bust, ink on volt, rounded like the product (hero radius scaled). */
export function iconResponse(size: number) {
  const radius = Math.round(size * 0.22);
  const bust = zebraDataUri({ variant: "bust", mood: "happy", size: 244 });
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "flex-end", justifyContent: "center", background: palette.volt, borderRadius: radius, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bust} width={size * 0.96} height={size * 0.96 * (184 / 200)} alt="" style={{ marginBottom: -size * 0.04 }} />
      </div>
    ),
    { width: size, height: size },
  );
}
