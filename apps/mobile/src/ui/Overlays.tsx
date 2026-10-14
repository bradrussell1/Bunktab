import { color, layout, motion, palette, radius, shadow, space } from "@bunktab/theme";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Press } from "./Press";
import { ZText } from "./Text";
import { useReducedMotion } from "./motion/useReducedMotion";

const rise = Easing.bezier(...(motion.rise.bezier as [number, number, number, number]));

/* ───────────── Toast ───────────── */

type ToastSpec = { message: string; action?: { label: string; onPress: () => void }; bust?: ReactNode; duration?: number };
const ToastCtx = createContext<{ show: (t: ToastSpec) => void }>({ show: () => {} });

/** `const { show } = useToast(); show({ message: "Invites sent", bust: <Zebra variant="bust" mood="wink" size={28} /> })` */
export function useToast() {
  return useContext(ToastCtx);
}

/** Mount once near the root. Ink pill, white text, optional volt action, rises in, 3 s. */
export function ToastProvider({ children, bottomOffset }: { children: ReactNode; bottomOffset?: number }) {
  const [toast, setToast] = useState<ToastSpec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: ToastSpec) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), t.duration ?? 3000);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toast ? <ToastView toast={toast} bottomOffset={bottomOffset} onDismiss={() => setToast(null)} /> : null}
    </ToastCtx.Provider>
  );
}

export function ToastView({ toast, bottomOffset, onDismiss }: { toast: ToastSpec; bottomOffset?: number; onDismiss?: () => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : 14);
  const o = useSharedValue(0);
  useEffect(() => {
    y.value = withTiming(0, { duration: reduced ? motion.moodCrossfade : motion.rise.duration, easing: rise });
    o.value = withTiming(1, { duration: reduced ? motion.moodCrossfade : motion.rise.duration, easing: rise });
  }, [y, o, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: o.value }));
  return (
    <Animated.View pointerEvents="box-none" accessibilityLiveRegion="polite" style={[styles.toastHost, { bottom: (bottomOffset ?? layout.bottomCtaPadding + 58 + 12) + insets.bottom }, style]}>
      <View style={styles.toast}>
        {toast.bust ? <View style={styles.toastBust}>{toast.bust}</View> : null}
        <ZText variant="bodyStrong" color={color.textOnInk} style={styles.toastText}>{toast.message}</ZText>
        {toast.action ? (
          <Press onPress={() => { toast.action?.onPress(); onDismiss?.(); }} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={toast.action.label} hitSlop={8}>
            <ZText variant="buttonS" color={color.accentOnInk}>{toast.action.label}</ZText>
          </Press>
        ) : null}
      </View>
    </Animated.View>
  );
}

/* ───────────── BottomSheet / ActionSheet ───────────── */

/** White sheet, top radius 30, sheet shadow, 36 × 5 sand grabber; the screen gradient stays behind it. */
export function BottomSheet({ open, onClose, children, title, style }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : 40);
  const o = useSharedValue(0);
  useEffect(() => {
    if (!open) return;
    y.value = reduced ? 0 : 40;
    o.value = 0;
    y.value = withTiming(0, { duration: reduced ? motion.moodCrossfade : motion.rise.duration, easing: rise });
    o.value = withTiming(1, { duration: reduced ? motion.moodCrossfade : motion.rise.duration, easing: rise });
  }, [open, y, o, reduced]);
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: o.value }));
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + space[16] }, sheet, style]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        {title ? <ZText variant="headline" style={styles.sheetTitle}>{title}</ZText> : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

export type SheetAction = { label: string; onPress: () => void; destructive?: boolean };

/** ActionSheet: stacked rows in a BottomSheet; destructive items in blushText. Never a system alert. */
export function ActionSheet({ open, onClose, title, actions, cancelLabel = "Cancel" }: { open: boolean; onClose: () => void; title?: string; actions: SheetAction[]; cancelLabel?: string }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <View style={styles.actions}>
        {actions.map((a) => (
          <Press key={a.label} onPress={() => { onClose(); a.onPress(); }} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={a.label} style={styles.actionRow}>
            <ZText variant="bodyStrong" color={a.destructive ? color.destructive : color.text}>{a.label}</ZText>
          </Press>
        ))}
        <Press onPress={onClose} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={cancelLabel} style={[styles.actionRow, styles.cancel]}>
          <ZText variant="bodyStrong" color={color.textMuted}>{cancelLabel}</ZText>
        </Press>
      </View>
    </BottomSheet>
  );
}

/* ───────────── SpeechBubble ───────────── */

/** Blush bubble, blushTextDeep 13/700, radius 16/16/16/4, pops in (scale .6 → 1.05 → 1, 450 ms). */
export function SpeechBubble({ children, style, tone = "blush" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "blush" | "white" | "cream" }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.6);
  useEffect(() => {
    s.value = reduced ? 1 : withSequence(withTiming(1.05, { duration: motion.boop.bubbleDuration * 0.6 }), withTiming(1, { duration: motion.boop.bubbleDuration * 0.4 }));
  }, [s, reduced]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const bg = tone === "blush" ? color.errorBg : tone === "cream" ? color.surfaceInset : palette.white;
  return (
    <Animated.View style={[styles.bubble, { backgroundColor: bg }, tone === "white" ? shadow.hairline : null, anim, style]}>
      <ZText variant="captionStrong" color={tone === "blush" ? palette.blushTextDeep : color.text}>{children}</ZText>
    </Animated.View>
  );
}

/* ───────────── Offline / error banners ───────────── */

/** Slim cream banner under the top bar: "Offline. Changes will sync." with a muted dot. */
export function Banner({ children, dot = "muted", style }: { children: ReactNode; dot?: "muted" | "pink" | "none"; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, style]}>
      {dot !== "none" ? <View style={[styles.dot, { backgroundColor: dot === "pink" ? color.attention : color.textMuted }]} /> : null}
      <ZText variant="small" color={color.textSecondary}>{children}</ZText>
    </View>
  );
}

const styles = StyleSheet.create({
  toastHost: { position: "absolute", left: layout.screenGutter, right: layout.screenGutter, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: space[10], backgroundColor: palette.ink, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 18, maxWidth: "100%", ...shadow.hero },
  toastBust: { width: 28, height: 26, alignItems: "center", justifyContent: "center" },
  toastText: { flexShrink: 1 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(29,26,23,0.28)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: palette.white, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingTop: 10, paddingHorizontal: layout.screenGutter, ...shadow.sheet },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: color.surfaceTile, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { marginBottom: 12 },
  actions: { gap: 4, paddingBottom: 6 },
  actionRow: { minHeight: 54, justifyContent: "center", paddingHorizontal: 8, borderRadius: radius.inset },
  cancel: { marginTop: 4 },
  bubble: { borderTopLeftRadius: radius.bubble.tl, borderTopRightRadius: radius.bubble.tr, borderBottomRightRadius: radius.bubble.br, borderBottomLeftRadius: radius.bubble.bl, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start", maxWidth: 260 },
  banner: { flexDirection: "row", alignItems: "center", gap: space[8], backgroundColor: color.surfaceInset, paddingVertical: 8, paddingHorizontal: layout.screenGutter },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
