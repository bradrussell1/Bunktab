import { color, layout, radius, space } from "@bunktab/theme";
import { useNetworkState } from "expo-network";
import { useEffect, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./Button";
import { InsetPanel } from "./Cards";
import { Banner, useToast } from "./Overlays";
import { ZText } from "./Text";
import { Zebra } from "./zebra/Zebra";

/**
 * Screen-level feedback (RESKIN_PROMPT B10).
 *  - ErrorPanel: a blush inset panel with a worried bust and "Try again" (Button.Secondary).
 *    Field errors stay inline in blushText under the field (Input's `error`); this is for
 *    a screen that couldn't load or an action that failed.
 *  - OfflineBanner: a slim cream banner under the status bar, "Offline. Changes will sync.",
 *    with a muted dot; a volt "Synced" toast when the connection comes back.
 */
export function ErrorPanel({ message, onRetry, retryLabel = "Try again", style }: { message: string; onRetry?: () => void; retryLabel?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={style}>
      <InsetPanel tone="blush" style={styles.error}>
        <View style={styles.errorRow}>
          <Zebra variant="bust" mood="worried" size={44} decorative />
          <ZText variant="bodyStrong" color={color.youOweText} style={styles.flex}>{message}</ZText>
        </View>
        {onRetry ? <Button kind="secondary" onWhite height={40} label={retryLabel} onPress={onRetry} style={styles.retry} /> : null}
      </InsetPanel>
    </View>
  );
}

/** Mount once at the root, above the navigator. Renders nothing while online. */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const net = useNetworkState();
  const { show } = useToast();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const wasOffline = useRef(false);
  useEffect(() => {
    if (offline) { wasOffline.current = true; return; }
    if (wasOffline.current) { wasOffline.current = false; show({ message: "Synced", tone: "volt", duration: 2000 }); }
  }, [offline, show]);
  if (!offline) return null;
  return (
    <View pointerEvents="none" style={[styles.offlineHost, { top: insets.top }]}>
      <Banner style={styles.offline}>Offline. Changes will sync.</Banner>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { gap: space[12], paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.inset + 4 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  retry: { alignSelf: "flex-start" },
  offlineHost: { position: "absolute", left: 0, right: 0, zIndex: 20, alignItems: "center", paddingHorizontal: layout.screenGutter },
  offline: { borderRadius: radius.pill, paddingHorizontal: 14 },
});
