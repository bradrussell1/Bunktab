import { palette } from "@bunktab/theme";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The three-layer background behind every screen (DESIGN_SYSTEM.md §3):
 *  1. vertical linear white → bgMid 50% → bgBottom
 *  2. volt radial wash, centre (0%, 22%), ellipse 100% × 45%, fading out at 55%
 *  3. pink radial wash, centre (100%, 0%), ellipse 120% × 55%, fading out at 60%
 * Drawn once in one absolutely-filled Svg. `wide` uses the web/system-board sizes.
 */
export function ScreenBackground({ wide = false }: { wide?: boolean }) {
  const pink = wide ? { rx: "70%", ry: "50%" } : { rx: "120%", ry: "55%" };
  const volt = wide ? { rx: "60%", ry: "45%" } : { rx: "100%", ry: "45%" };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="zs-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.bgTop} />
            <Stop offset="0.5" stopColor={palette.bgMid} />
            <Stop offset="1" stopColor={palette.bgBottom} />
          </LinearGradient>
          <RadialGradient id="zs-volt" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.washVolt} stopOpacity={1} />
            <Stop offset="0.55" stopColor={palette.washVolt} stopOpacity={0} />
            <Stop offset="1" stopColor={palette.washVolt} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="zs-pink" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.washPink} stopOpacity={1} />
            <Stop offset="0.6" stopColor={palette.washPink} stopOpacity={0} />
            <Stop offset="1" stopColor={palette.washPink} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#zs-bg)" />
        <Ellipse cx="0%" cy="22%" rx={volt.rx} ry={volt.ry} fill="url(#zs-volt)" />
        <Ellipse cx="100%" cy="0%" rx={pink.rx} ry={pink.ry} fill="url(#zs-pink)" />
      </Svg>
    </View>
  );
}
