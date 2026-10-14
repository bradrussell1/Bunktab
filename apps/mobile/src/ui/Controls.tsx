import { color, motion, palette, radius, shadow, size, space, type } from "@bunktab/theme";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Press } from "./Press";
import { ZText } from "./Text";
import { Zebra } from "./zebra/Zebra";

/** SegmentedControl: 6% ink track, radius full, padding 4; active = white + tiny shadow. */
export function SegmentedControl<K extends string>({ options, value, onChange, style }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="tablist" style={[styles.segTrack, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Press key={o.key} onPress={() => onChange(o.key)} scaleTo={0.98} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={o.label} style={[styles.seg, active ? styles.segActive : null]}>
            <ZText variant="label" color={active ? color.text : color.textMuted} style={active ? null : styles.segInactiveText}>{o.label}</ZText>
          </Press>
        );
      })}
    </View>
  );
}

/** Toggle: 52 × 32 track (ink on / trackOff off), 26 px knob (volt on / white off), sprung. */
export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const x = useSharedValue(value ? size.toggle.width - size.toggle.knob - 3 : 3);
  const bg = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = withSpring(value ? size.toggle.width - size.toggle.knob - 3 : 3, { damping: 15, stiffness: 240 });
    bg.value = withTiming(value ? 1 : 0, { duration: motion.colorChange });
  }, [value, x, bg]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], backgroundColor: bg.value > 0.5 ? palette.volt : palette.white }));
  const track = useAnimatedStyle(() => ({ backgroundColor: bg.value > 0.5 ? palette.ink : palette.trackOff }));
  return (
    <Press
      onPress={() => { if (!disabled) { Haptics.selectionAsync().catch(() => {}); onChange(!value); } }}
      scaleTo={0.97}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={8}
      style={{ width: size.toggle.width, height: size.toggle.height }}
    >
      <Animated.View style={[styles.toggleTrack, track]}>
        <Animated.View style={[styles.toggleKnob, knob]} />
      </Animated.View>
    </Press>
  );
}

export type InputProps = Omit<TextInputProps, "style"> & {
  label?: string;
  error?: string | null;
  helper?: string;
  /** Multi-line: radius 22 field instead of a pill. */
  multiline?: boolean;
  right?: ReactNode;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Counter for TextArea: current / max; muted, blushText at the limit. */
  counter?: { value: number; max: number };
};

/**
 * Input: white pill (or radius-22 field when multiline), 1.5 hairline, 15/400 ink,
 * muted placeholder; focus = ink outline; label above 13/700; error below blushText 13/600.
 */
export function Input({ label, error, helper, multiline, right, left, style, counter, onFocus, onBlur, editable = true, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const atLimit = counter ? counter.value >= counter.max : false;
  return (
    <View style={style}>
      {label ? <ZText variant="captionStrong" style={styles.inputLabel}>{label}</ZText> : null}
      <View style={[styles.field, multiline ? styles.fieldMulti : styles.fieldPill, { borderColor: error ? color.error : focused ? color.text : color.outline }, !editable ? { backgroundColor: color.surfaceTile } : null]}>
        {left}
        <TextInput
          {...rest}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={color.textMuted}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          style={[styles.inputText, multiline ? styles.inputMulti : null]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.inputError} accessibilityLiveRegion="polite">
          <Zebra variant="bust" mood="worried" size={26} decorative />
          <ZText variant="small" color={color.error} style={styles.inputErrorText}>{error}</ZText>
        </View>
      ) : helper || counter ? (
        <View style={styles.inputMetaRow}>
          {helper ? <ZText variant="small" color={color.textMuted}>{helper}</ZText> : <View />}
          {counter ? <ZText variant="small" color={atLimit ? color.error : color.textMuted} tabular>{counter.value}/{counter.max}</ZText> : null}
        </View>
      ) : null}
    </View>
  );
}

export function TextArea(props: InputProps) {
  return <Input {...props} multiline />;
}

/**
 * CodeCells: six 48 px white rounded cells with hairline outlines; the cell about to be
 * filled gets an ink outline; typing auto-advances (one hidden TextInput drives them).
 */
export function CodeCells({ value, onChange, length = 6, error, autoFocus, onComplete }: { value: string; onChange: (v: string) => void; length?: number; error?: string | null; autoFocus?: boolean; onComplete?: (v: string) => void }) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, "").slice(0, length);
  const active = Math.min(digits.length, length - 1);
  return (
    <View>
      <Press onPress={() => ref.current?.focus()} scaleTo={0.98} accessibilityRole="none" style={styles.cells}>
        {Array.from({ length }, (_, i) => {
          const isActive = focused && i === active;
          return (
            <View key={i} style={[styles.cell, { borderColor: error ? color.error : isActive ? color.text : color.outline }]} accessibilityElementsHidden>
              <ZText variant="title2" tabular>{digits[i] ?? ""}</ZText>
            </View>
          );
        })}
      </Press>
      <TextInput
        ref={ref}
        value={digits}
        onChangeText={(v) => { const d = v.replace(/\D/g, "").slice(0, length); onChange(d); if (d.length === length) onComplete?.(d); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        accessibilityLabel={`${length}-digit code`}
        caretHidden
        style={styles.hiddenInput}
      />
      {error ? (
        <View style={styles.inputError} accessibilityLiveRegion="polite">
          <Zebra variant="bust" mood="worried" size={26} decorative />
          <ZText variant="small" color={color.error} style={styles.inputErrorText}>{error}</ZText>
        </View>
      ) : null}
    </View>
  );
}

/** Ink, underlined text link with a 44 px target ("Check it", "Forgot your password?"). */
export function TextLink({ label, onPress, muted, style }: { label: string; onPress: () => void; muted?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Press onPress={onPress} scaleTo={0.98} accessibilityRole="link" accessibilityLabel={label} hitSlop={6} style={[styles.link, style]}>
      <ZText variant="label" color={muted ? color.textMuted : color.text} style={styles.linkText}>{label}</ZText>
    </Press>
  );
}

const styles = StyleSheet.create({
  segTrack: { flexDirection: "row", backgroundColor: color.segmentTrack, borderRadius: radius.pill, padding: 4, height: size.segmentHeight },
  seg: { flex: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: palette.white, ...shadow.hairline },
  segInactiveText: { fontFamily: undefined },
  toggleTrack: { width: size.toggle.width, height: size.toggle.height, borderRadius: radius.pill, justifyContent: "center" },
  toggleKnob: { width: size.toggle.knob, height: size.toggle.knob, borderRadius: size.toggle.knob / 2, ...shadow.hairline },
  inputLabel: { marginBottom: 6, marginLeft: 4 },
  field: { backgroundColor: palette.white, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: space[8], paddingHorizontal: 16 },
  fieldPill: { borderRadius: radius.pill, minHeight: size.buttonHeight },
  fieldMulti: { borderRadius: radius.row, minHeight: 112, alignItems: "flex-start", paddingVertical: 12 },
  inputText: { flex: 1, paddingVertical: 12, color: color.text, ...type.body },
  inputMulti: { textAlignVertical: "top", minHeight: 88, paddingVertical: 0 },
  inputMeta: { marginTop: 6, marginLeft: 4 },
  inputMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginHorizontal: 4 },
  inputError: { flexDirection: "row", alignItems: "center", gap: space[6], marginTop: 6, marginLeft: 2 },
  inputErrorText: { flex: 1 },
  cells: { flexDirection: "row", justifyContent: "space-between", gap: space[8] },
  cell: { flex: 1, maxWidth: 48, height: 56, borderRadius: radius.tile, backgroundColor: palette.white, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  link: { minHeight: size.iconButton, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { textDecorationLine: "underline" },
});
