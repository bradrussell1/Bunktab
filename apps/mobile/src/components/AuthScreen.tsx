import { color, layout, space, radius } from "@bunktab/theme";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground, TopBar, Zebra, ZText, useKeyboardVisible } from "@/ui";

/**
 * The auth funnel's frame (RESKIN_PROMPT B1): the gradient background, an optional
 * back TopBar, an optional zebra block above the title, title1 + lead, the form,
 * and a footer. Gutters: 16 for controls, 20 for headings and loose text
 * (DESIGN_SYSTEM.md §5). The footer (the screen's CTA) hides while the keyboard is up
 * and returns on blur, so the keyboard never covers it; the focused field scrolls
 * into view (feedback round 1, item 5).
 */
export function AuthScreen({ onBack, hero, title, lead, children, footer, contentStyle, centered, keepFooter }: {
  onBack?: () => void;
  hero?: ReactNode;
  title?: string;
  lead?: string;
  children?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Vertically centre the content (landing, profile). */
  centered?: boolean;
  /** Keep the footer visible while typing (screens with no field of their own). */
  keepFooter?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const showFooter = !!footer && (keepFooter || !keyboard);
  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {onBack ? <TopBar onBack={onBack} /> : <View style={{ height: insets.top + layout.topBarTopPadding }} />}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, centered ? styles.centered : null, { paddingBottom: showFooter ? space[16] : layout.bottomCtaPadding + insets.bottom }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="never"
        >
          {hero ? <View style={styles.hero}>{hero}</View> : null}
          {title || lead ? (
            <View style={styles.head}>
              {title ? <ZText variant="title1" accessibilityRole="header">{title}</ZText> : null}
              {lead ? <ZText variant="body" color={color.textSecondary}>{lead}</ZText> : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
        {showFooter ? <View style={[styles.footer, { paddingBottom: layout.bottomCtaPadding + insets.bottom }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Screen-level error: blushText beside a small worried bust (B1 "errors … zebra bust worried beside the message"). */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Zebra variant="bust" mood="worried" size={30} decorative />
      <ZText variant="small" color={color.error} style={styles.errorText}>{children}</ZText>
    </View>
  );
}

/** The thin "or" rule between the OAuth buttons and the email/phone path. */
export function OrRule() {
  return (
    <View style={styles.or}>
      <View style={styles.rule} />
      <ZText variant="small" color={color.textMuted}>or</ZText>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: layout.screenGutter, gap: space[16] },
  centered: { justifyContent: "center" },
  hero: { alignItems: "center", paddingTop: space[8] },
  head: { gap: space[8], paddingHorizontal: layout.textGutter - layout.screenGutter, marginBottom: space[4] },
  footer: { paddingHorizontal: layout.screenGutter, paddingTop: space[12], gap: space[12] },
  error: { flexDirection: "row", alignItems: "center", gap: space[8], paddingHorizontal: layout.textGutter - layout.screenGutter },
  errorText: { flex: 1 },
  or: { flexDirection: "row", alignItems: "center", gap: space[12], paddingHorizontal: space[4] },
  rule: { flex: 1, height: 1.5, backgroundColor: color.outline, borderRadius: radius.pill },
});
