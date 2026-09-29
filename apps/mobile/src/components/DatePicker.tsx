import { clampMonth, compareMonth, formatDateLong, monthGrid, monthLabel, monthOf, monthRange, shiftMonth, todayIso, WEEKDAYS_SHORT, type YearMonth } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { FieldSurface, Text } from "./ui";

/**
 * Date field + calendar sheet (spec: Create trip → start and end dates).
 * The field shows "Fri, Oct 2, 2026" or "Pick a date"; tapping it opens a
 * bottom sheet with a month grid. Month + year sit centred in the header
 * between ‹ › chevrons; tapping the month name opens a smaller overlay that
 * jumps to any month within six back and six forward of today (the
 * chevrons stop at the same bounds). Days outside the month are dimmed and
 * disabled; `min` disables earlier days (the end date can't precede the
 * start). All arithmetic is on civil dates through @checkm8/core, so a
 * date never shifts with the device timezone.
 */
export function DateField({ label, value, onChange, min, placeholder = "Pick a date", devOpen = false, devJump = false }: { label: string; value: string; onChange: (iso: string) => void; min?: string; placeholder?: string; devOpen?: boolean; devJump?: boolean }) {
  const [open, setOpen] = useState(devOpen); // devOpen/devJump: DEV-only, for screenshots and tests
  useEffect(() => { if (devOpen) setOpen(true); }, [devOpen]);
  useFocusEffect(useCallback(() => () => setOpen(false), [])); // never leave the sheet up over another screen
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDateLong(value) : placeholder}`}>
        <FieldSurface focused={open} style={{ height: 48, paddingHorizontal: 12 }}>
          <Text variant="body" color={value ? theme.colors.hero.ink : theme.colors.hero.inkMid} numberOfLines={1}>{value ? formatDateLong(value) : placeholder}</Text>
        </FieldSurface>
      </Pressable>
      <CalendarSheet visible={open} title={label} value={value} min={min} initialJump={devJump} onClose={() => setOpen(false)} onPick={(d) => { onChange(d); setOpen(false); }} />
    </View>
  );
}

export function CalendarSheet({ visible, title, value, min, initialJump = false, onClose, onPick }: { visible: boolean; title: string; value: string; min?: string; initialJump?: boolean; onClose: () => void; onPick: (iso: string) => void }) {
  const today = todayIso();
  const anchor = useMemo(() => monthOf(today), [today]);
  const [ym, setYm] = useState<YearMonth>(() => clampMonth(value ? monthOf(value) : anchor, anchor));
  const [jump, setJump] = useState(initialJump);
  useEffect(() => setJump(initialJump), [initialJump]);
  const lo = shiftMonth(anchor, -6), hi = shiftMonth(anchor, 6);
  const cells = useMemo(() => monthGrid(ym.year, ym.month, today), [ym, today]);
  const canPrev = compareMonth(ym, lo) > 0, canNext = compareMonth(ym, hi) < 0;

  // re-centre on the current value each time the sheet opens
  const [seenOpen, setSeenOpen] = useState(false);
  if (visible && !seenOpen) { setSeenOpen(true); setYm(clampMonth(value ? monthOf(value) : anchor, anchor)); setJump(initialJump); }
  if (!visible && seenOpen) setSeenOpen(false);

  const disabled = (iso: string, inMonth: boolean) => !inMonth || (!!min && iso < min);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.system.dimming40 }} onPress={onClose} accessibilityLabel="Close calendar" />
      <View style={{ backgroundColor: theme.colors.background.elevated, borderTopLeftRadius: theme.radius.sheet, borderTopRightRadius: theme.radius.sheet, padding: theme.screenPadding, paddingBottom: 36, gap: theme.spacing.md, ...theme.elevation.sm }}>
        <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.divider.default }} />
        <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary} style={{ textAlign: "center" }}>{title}</Text>

        {/* header: ‹  Month Year  › */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Chevron dir="‹" enabled={canPrev} onPress={() => setYm((m) => clampMonth(shiftMonth(m, -1), anchor))} label="Previous month" />
          <Pressable onPress={() => setJump((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: jump }} accessibilityLabel="Choose month" hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: jump ? theme.colors.fill.secondary : "transparent" }}>
            <Text variant="title2">{monthLabel(ym)}</Text>
            <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>{jump ? "▴" : "▾"}</Text>
          </Pressable>
          <Chevron dir="›" enabled={canNext} onPress={() => setYm((m) => clampMonth(shiftMonth(m, 1), anchor))} label="Next month" />
        </View>

        <View>
          {/* weekday row */}
          <View style={{ flexDirection: "row" }}>
            {WEEKDAYS_SHORT.map((w) => <Text key={w} variant="caption3" color={theme.colors.text.onBackground.tertiary} style={{ flex: 1, textAlign: "center", paddingVertical: 4 }}>{w}</Text>)}
          </View>
          {/* 6 × 7 grid */}
          {Array.from({ length: 6 }, (_, r) => (
            <View key={r} style={{ flexDirection: "row" }}>
              {cells.slice(r * 7, r * 7 + 7).map((c) => {
                const off = disabled(c.iso, c.inMonth), selected = c.iso === value;
                return (
                  <Pressable key={c.iso} disabled={off} onPress={() => onPick(c.iso)} accessibilityRole="button" accessibilityState={{ disabled: off, selected }} accessibilityLabel={formatDateLong(c.iso)}
                    style={{ flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: selected ? theme.colors.fill.primary : "transparent", borderWidth: selected || c.isToday ? 1 : 0, borderColor: theme.colors.border.primary }}>
                      <Text variant={selected || c.isToday ? "caption1Semibold" : "caption1"} color={selected ? theme.colors.text.onFill.onPrimary : off ? theme.colors.text.onBackground.tertiary : theme.colors.text.onBackground.primary} style={off && !c.inMonth ? { opacity: 0.5 } : undefined}>{c.day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {/* month jump: a smaller overlay over the grid */}
          {jump && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.background.elevated, opacity: 0.92 }} onPress={() => setJump(false)} accessibilityLabel="Close month list" />
              <View style={{ width: "88%", borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border.neutral, backgroundColor: theme.colors.background.surface, padding: theme.spacing.md, gap: theme.spacing.sm, ...theme.elevation.sm }}>
                <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary} style={{ textAlign: "center" }}>Jump to</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, justifyContent: "center" }}>
                  {monthRange(anchor).map((m) => {
                    const on = compareMonth(m, ym) === 0, isNow = compareMonth(m, anchor) === 0;
                    return (
                      <Pressable key={`${m.year}-${m.month}`} onPress={() => { setYm(m); setJump(false); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={{ width: "30%", paddingVertical: 10, alignItems: "center", borderRadius: theme.radius.control, borderWidth: 1, borderColor: on ? theme.colors.border.primary : isNow ? theme.colors.border.neutral : "transparent", backgroundColor: on ? theme.colors.fill.primary : theme.colors.fill.secondary }}>
                        <Text variant="caption1Semibold" color={on ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.primary}>{monthLabel(m, false).slice(0, 3)}</Text>
                        <Text variant="caption3" color={on ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.tertiary}>{m.year}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>
        <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>{min ? `From ${formatDateLong(min)}` : "Tap a day"}</Text>
      </View>
    </Modal>
  );
}

function Chevron({ dir, enabled, onPress, label }: { dir: "‹" | "›"; enabled: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} disabled={!enabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} hitSlop={8}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.fill.secondary, opacity: enabled ? 1 : 0.35 }}>
      <Text variant="title2" style={{ lineHeight: 24, marginTop: -2 }}>{dir}</Text>
    </Pressable>
  );
}
