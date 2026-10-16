import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode, RefObject } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ContextPill, ScreenBackground, TopBar, Zebra, ZText } from "@/ui";
import type { ZebraMood } from "@bunktab/core";

/**
 * The five receipt screens share one shell (RECEIPT_SPLIT_PROMPT, Part 4): gradient
 * background, TopBar with back and a context pill, a scrolling body, and a DOCKED
 * primary action outside the scroll view, pinned to the bottom over a cream fade so it
 * is always visible. Nothing has to fit in one viewport.
 */
export function FlowScreen({ context, onBack, title, caption, bust, right, children, footer, scrollRef, contentStyle, sheet }: {
  context: string;
  onBack: () => void;
  title?: string;
  caption?: ReactNode;
  /** A zebra bust beside the title (its mood crossfades). */
  bust?: { mood: ZebraMood; label: string };
  /** Something at the title's right (the "Adds up" pill). */
  right?: ReactNode;
  children: ReactNode;
  /** Docked content: a CTA, or a whole sheet. */
  footer?: ReactNode;
  /** When true the footer is a white top-rounded sheet instead of a fade. */
  sheet?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.host}>
      <ScreenBackground />
      <TopBar onBack={onBack} right={<ContextPill style={styles.context}>{context}</ContextPill>} />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: (sheet ? 300 : 120) + insets.bottom }, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {title ? (
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <ZText variant="titleCompact" accessibilityRole="header">{title}</ZText>
                {typeof caption === "string" ? <ZText variant="caption" color={color.textMuted}>{caption}</ZText> : caption}
              </View>
              {right}
              {bust ? <Zebra variant="bust" mood={bust.mood} size={60} animate={{ blink: true }} accessibilityLabel={bust.label} style={styles.bust} /> : null}
            </View>
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        sheet ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space[12] }]}>{footer}</View>
        ) : (
          <View style={[styles.dock, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]} pointerEvents="box-none">
            <LinearGradient colors={[...color.dockFade]} locations={[0, 0.4]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            {footer}
          </View>
        )
      ) : null}
    </View>
  );
}

/** The docked primary action: volt when ready, the locked style (with the reason as the label) when not. */
export function DockedCta({ label, locked, onPress, loading, accessibilityLabel }: { label: string; locked?: boolean; onPress?: () => void; loading?: boolean; accessibilityLabel?: string }) {
  return <Button kind={locked ? "locked" : "primary"} label={label} onPress={onPress} loading={loading} accessibilityLabel={accessibilityLabel} />;
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: palette.bgMid },
  context: { maxWidth: 240 },
  content: { paddingTop: space[4], gap: space[16] },
  titleBlock: { paddingHorizontal: layout.textGutter },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: space[8] },
  titleText: { flex: 1, gap: 2 },
  bust: { marginBottom: -4 },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.screenGutter, paddingTop: space[24] },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: palette.white, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingTop: space[12], paddingHorizontal: layout.screenGutter, gap: space[10], ...shadow.sheet },
});
