import { color, layout, palette, radius, space } from "@bunktab/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconButton, RowCard, TextLink, ZText } from "@/ui";
import { DEMO_ID, signReceipt } from "@/lib/receipts";

/**
 * "Receipt photo saved to this Dazzle" with View: appears on every screen of the flow.
 * View opens a full-screen, pinch-zoom viewer that loads the photo through a short
 * signed URL (the bucket is private).
 */
export function ReceiptRow({ receiptId, storagePath }: { receiptId: string; storagePath: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <RowCard
        tile={<Icon name="receipt" size={20} />}
        title="Receipt photo saved to this Dazzle"
        right={<TextLink label="View" onPress={() => setOpen(true)} />}
        accessibilityLabel="Receipt photo saved to this Dazzle. View opens the photo"
      />
      <PhotoViewer open={open} onClose={() => setOpen(false)} receiptId={receiptId} storagePath={storagePath} />
    </View>
  );
}

export function PhotoViewer({ open, onClose, receiptId, storagePath }: { open: boolean; onClose: () => void; receiptId: string; storagePath: string }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailed(false);
    if (receiptId === DEMO_ID) { setUrl(null); return; }
    signReceipt(storagePath).then((u) => { if (!live) return; if (u) setUrl(u); else setFailed(true); });
    return () => { live = false; };
  }, [open, receiptId, storagePath]);
  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <ScrollView maximumZoomScale={5} minimumZoomScale={1} centerContent contentContainerStyle={{ width, minHeight: height }} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} bouncesZoom>
          {url ? <Image source={{ uri: url }} style={{ width, height }} resizeMode="contain" accessibilityLabel="Receipt photo" accessibilityIgnoresInvertColors /> : (
            <View style={[styles.center, { height }]}>
              {failed ? <ZText variant="body" color={palette.white}>Couldn't load the photo.</ZText> : receiptId === DEMO_ID ? <View style={styles.demoPaper}><ZText variant="receipt">EL FARO CANTINA</ZText><ZText variant="receipt" color={color.textMuted}>demo receipt</ZText></View> : <ActivityIndicator color={palette.white} />}
            </View>
          )}
        </ScrollView>
        <View style={[styles.close, { top: insets.top + layout.topBarTopPadding }]}>
          <IconButton name="close" label="Close the photo" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenGutter },
  viewer: { flex: 1, backgroundColor: palette.ink },
  center: { alignItems: "center", justifyContent: "center", gap: space[8] },
  demoPaper: { backgroundColor: palette.white, padding: space[24], borderRadius: radius.tile, alignItems: "center", gap: 4 },
  close: { position: "absolute", right: layout.screenGutter },
});
