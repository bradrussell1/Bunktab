import { color } from "@bunktab/theme";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

export type IconName = "chevronLeft" | "chevronRight" | "chevronDown" | "chevronUp" | "plus" | "search" | "person" | "more" | "camera" | "check" | "close" | "link" | "moon" | "send" | "share" | "bell"
  | "plane" | "bed" | "home" | "utensils" | "cocktail" | "bag" | "dish" | "cart" | "bottle" | "car" | "parking" | "ticket" | "tag" | "arrowUpRight" | "trash" | "wifiOff"
  | "receipt" | "equals" | "dollar" | "forkKnife" | "minus" | "pencil";

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
      {/* category glyphs (expense tiles): one per top-level category and subcategory, all stroke */}
      {name === "plane" && <Path d="M10.5 13.5 4 11l1.5-1.5 6 1.2 4.3-4.3a1.6 1.6 0 0 1 2.3 2.3L13.8 13l1.2 6-1.5 1.5-2.5-6.5-3 3 .3 2.2-1.3 1.3-1.5-3-3-1.5 1.3-1.3z" {...common} />}
      {name === "bed" && <><Path d="M3 18V8" {...common} /><Path d="M3 12h18v6" {...common} /><Path d="M3 15h18" {...common} /><Path d="M7 12V9.5A1.5 1.5 0 0 1 8.5 8h3a1.5 1.5 0 0 1 1.5 1.5V12" {...common} /></>}
      {name === "home" && <><Path d="M4 11 12 4l8 7" {...common} /><Path d="M6 10v9h12v-9" {...common} /><Path d="M10 19v-5h4v5" {...common} /></>}
      {name === "utensils" && <><Path d="M7 3v8a2 2 0 0 0 2 2v8" {...common} /><Path d="M5 3v4a2 2 0 0 0 4 0V3" {...common} /><Path d="M17 3c-2 1.5-3 4-3 7h3v11" {...common} /></>}
      {name === "cocktail" && <><Path d="M5 4h14l-7 8z" {...common} /><Path d="M12 12v7" {...common} /><Path d="M8 19h8" {...common} /><Path d="M8 7h8" {...common} /></>}
      {name === "bag" && <><Path d="M5 8h14l-1 12H6z" {...common} /><Path d="M9 8V6a3 3 0 0 1 6 0v2" {...common} /></>}
      {name === "dish" && <><Path d="M4 15h16" {...common} /><Path d="M5 15a7 7 0 0 1 14 0" {...common} /><Path d="M12 8V6.5" {...common} /><Path d="M3 18h18" {...common} /></>}
      {name === "cart" && <><Path d="M3 5h2l2.2 10h10.3L20 8H6.2" {...common} /><Circle cx="9" cy="19" r="1.5" {...common} /><Circle cx="16" cy="19" r="1.5" {...common} /></>}
      {name === "bottle" && <><Path d="M10 3h4v4l1.5 2.5c.3.5.5 1 .5 1.6V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-7.9c0-.6.2-1.1.5-1.6L10 7z" {...common} /><Path d="M8 14h8" {...common} /></>}
      {name === "car" && <><Path d="M4 13l1.8-5a2 2 0 0 1 1.9-1.3h8.6a2 2 0 0 1 1.9 1.3L20 13" {...common} /><Path d="M3 13h18v5H3z" {...common} /><Circle cx="7.5" cy="18" r="1.5" {...common} /><Circle cx="16.5" cy="18" r="1.5" {...common} /></>}
      {name === "parking" && <><Path d="M5 4h14v16H5z" {...common} /><Path d="M9.5 16V8h3.5a2.5 2.5 0 0 1 0 5H9.5" {...common} /></>}
      {name === "ticket" && <><Path d="M4 8V6h16v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2H4v-2a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4z" {...common} /><Path d="M10 6v12" {...common} strokeDasharray="2 2" /></>}
      {name === "tag" && <><Path d="M3 11V4h7l10 10-7 7z" {...common} /><Circle cx="7.5" cy="8.5" r="1.3" {...common} /></>}
      {name === "arrowUpRight" && <><Path d="M7 17 17 7" {...common} /><Path d="M9 7h8v8" {...common} /></>}
      {name === "trash" && <><Path d="M4 7h16" {...common} /><Path d="M9 7V4h6v3" {...common} /><Path d="M6 7l1 13h10l1-13" {...common} /></>}
      {/* receipt flow */}
      {name === "receipt" && <><Path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z" {...common} /><Path d="M9 8h6M9 11.5h6M9 15h4" {...common} /></>}
      {name === "equals" && <><Path d="M6 9.5h12" {...common} /><Path d="M6 14.5h12" {...common} /></>}
      {name === "dollar" && <><Circle cx="12" cy="12" r="8.5" {...common} /><Path d="M12 7v10" {...common} /><Path d="M14.5 9.5c0-1-1.1-1.7-2.5-1.7s-2.5.7-2.5 1.7 1 1.5 2.5 1.8 2.5.9 2.5 1.9-1.1 1.8-2.5 1.8-2.5-.8-2.5-1.8" {...common} /></>}
      {name === "forkKnife" && <><Path d="M7 3v7a2 2 0 0 0 2 2v9" {...common} /><Path d="M5 3v4a2 2 0 0 0 4 0V3" {...common} /><Path d="M17 3c-2 1.5-3 4-3 7h3v11" {...common} /></>}
      {name === "minus" && <Line x1="6" y1="12" x2="18" y2="12" {...common} />}
      {name === "pencil" && <><Path d="M4 20l4-1 10.5-10.5a2 2 0 0 0-3-3L5 16z" {...common} /><Path d="M13.5 7.5l3 3" {...common} /></>}
      {name === "wifiOff" && <><Path d="M3 3l18 18" {...common} /><Path d="M5 10a12 12 0 0 1 4.5-2.6M12 6a12 12 0 0 1 7 4" {...common} /><Path d="M8.5 13.5a7 7 0 0 1 2.3-1.3M15.5 13.5a7 7 0 0 0-2-1.2" {...common} /><Circle cx="12" cy="18" r="1" fill={c} /></>}
    </Svg>
  );
}
