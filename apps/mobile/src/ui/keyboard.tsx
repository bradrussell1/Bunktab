import { color, layout, palette, space } from "@bunktab/theme";
import { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import { TextLink } from "./Controls";

/**
 * Keyboard rules (feedback round 1, items 5 and 15): a screen's bottom CTA hides while
 * the keyboard is up and comes back on blur, so the keyboard can never cover it; the
 * focused field scrolls into view (the ScrollView's automaticallyAdjustKeyboardInsets on
 * iOS, KeyboardAvoidingView elsewhere); single-line fields use return key `done`/`next`
 * and dismiss on submit; number pads, which have no return key, get a "Done" bar.
 */
export function useKeyboard(): { visible: boolean; height: number } {
  const [state, setState] = useState({ visible: false, height: 0 });
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, (e) => setState({ visible: true, height: e.endCoordinates.height }));
    const b = Keyboard.addListener(hideEvt, () => setState({ visible: false, height: 0 }));
    return () => { a.remove(); b.remove(); };
  }, []);
  return state;
}

export function useKeyboardVisible(): boolean {
  return useKeyboard().visible;
}

/**
 * A slim white "Done" bar that sits directly on top of the keyboard while it is up (for
 * number pads, which have no return key). Mount it inside a view that reaches the bottom
 * of the screen; it positions itself by the keyboard's height. (A native
 * InputAccessoryView was tried first and never appeared inside the expense sheet's
 * transparent modal, so this is plain layout.)
 */
export const KEYBOARD_BAR_HEIGHT = 40;

export function KeyboardDoneBar() {
  const { visible, height } = useKeyboard();
  if (!visible) return null;
  return (
    <View style={[styles.bar, { bottom: height }]} accessibilityRole="toolbar">
      <TextLink label="Done" onPress={() => Keyboard.dismiss()} style={styles.done} />
    </View>
  );
}

const styles = StyleSheet.create({
  done: { alignSelf: "flex-end" },
  bar: { position: "absolute", left: 0, right: 0, height: KEYBOARD_BAR_HEIGHT, backgroundColor: palette.white, borderTopWidth: 1, borderTopColor: color.divider, paddingHorizontal: layout.screenGutter, paddingVertical: space[2], alignItems: "flex-end", justifyContent: "center" },
});
