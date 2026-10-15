import { motion } from "@bunktab/theme";
import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressProps = Omit<PressableProps, "style" | "children"> & {
  /** Scale on press: 0.97 for large surfaces, 0.98 for cards (DESIGN_SYSTEM.md §9). */
  scaleTo?: 0.97 | 0.98;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Every pressable: scales down on press (120 ms) and springs back on release. */
export function Press({ scaleTo = 0.97, style, children, onPressIn, onPressOut, disabled, ...rest }: PressProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => { scale.value = withTiming(scaleTo, { duration: 120 }); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }); onPressOut?.(e); }}
      style={[animated, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

export const pressDuration = motion.colorChange;
