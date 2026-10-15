import { defaultOg, OG_SIZE } from "@/lib/og";

export const alt = "Zebrasplit · Split the trip. Not the friendship.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return defaultOg();
}
