import { color } from "@bunktab/theme";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

export type IconName = "chevronLeft" | "chevronRight" | "chevronDown" | "chevronUp" | "plus" | "search" | "person" | "more" | "camera" | "check" | "close" | "link" | "moon" | "send" | "share" | "bell";

/**
 * The app's stroke icons, 24-unit viewBox, ink by default, 1.8–2.4 stroke
 * (DESIGN_SYSTEM.md §6 IconButton). No icon font.
 */
export function Icon({ name, size = 22, color: c = color.text, stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const common = { stroke: c, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === "chevronLeft" && <Polyline points="15 5 8 12 15 19" {...common} />}
      {name === "chevronRight" && <Polyline points="9 5 16 12 9 19" {...common} />}
      {name === "chevronDown" && <Polyline points="5 9 12 16 19 9" {...common} />}
      {name === "chevronUp" && <Polyline points="5 15 12 8 19 15" {...common} />}
      {name === "plus" && <><Line x1="12" y1="5" x2="12" y2="19" {...common} /><Line x1="5" y1="12" x2="19" y2="12" {...common} /></>}
      {name === "search" && <><Circle cx="11" cy="11" r="6.5" {...common} /><Line x1="16" y1="16" x2="20.5" y2="20.5" {...common} /></>}
      {name === "person" && <><Circle cx="12" cy="8.5" r="4" {...common} /><Path d="M4.5 20c1.5-4 4-5.5 7.5-5.5s6 1.5 7.5 5.5" {...common} /></>}
      {name === "more" && <><Circle cx="6" cy="12" r="1.6" fill={c} /><Circle cx="12" cy="12" r="1.6" fill={c} /><Circle cx="18" cy="12" r="1.6" fill={c} /></>}
      {name === "camera" && <><Path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z" {...common} /><Circle cx="12" cy="13.3" r="3.2" {...common} /></>}
      {name === "check" && <Polyline points="5 12.5 10 17.5 19 7" {...common} />}
      {name === "close" && <><Line x1="6" y1="6" x2="18" y2="18" {...common} /><Line x1="18" y1="6" x2="6" y2="18" {...common} /></>}
      {name === "link" && <><Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" {...common} /><Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" {...common} /></>}
      {name === "moon" && <Path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.5A9 9 0 0 1 14.5 3.5z" {...common} />}
      {name === "send" && <><Path d="M4 12 20 4l-4 16-4.5-7z" {...common} /><Line x1="11.5" y1="13" x2="20" y2="4" {...common} /></>}
      {name === "share" && <><Path d="M12 3v12" {...common} /><Polyline points="7.5 7.5 12 3 16.5 7.5" {...common} /><Path d="M5 12v8h14v-8" {...common} /></>}
      {name === "bell" && <><Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" {...common} /><Path d="M10 20a2 2 0 0 0 4 0" {...common} /></>}
    </Svg>
  );
}
