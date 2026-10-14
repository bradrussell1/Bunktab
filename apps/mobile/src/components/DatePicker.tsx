import { clampMonth, compareMonth, formatDateLong, monthGrid, monthLabel, monthOf, monthRange, shiftMonth, todayIso, WEEKDAYS_SHORT, type YearMonth } from "@bunktab/core";
import { color, palette, radius, size, space } from "@bunktab/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { BottomSheet, Icon, IconButton, Press, ZText } from "@/ui";

/**
 * Date field + calendar sheet (spec: Create a dazzle → start and end dates), on the
 * Zebrasplit kit: a white pill field (ink outline while the sheet is up) and a
 * BottomSheet with a month grid. Month + year sit centred between ‹ › buttons;
 * tapping the month opens a jump grid six months back and forward of today. Days
 * outside the month are dimmed and disabled; `min` disables earlier days (the end
 * date can't precede the start). All arithmetic is on civil dates through
 * @bunktab/core, so a date never shifts with the device timezone.
 */
export function DateField({ label, value, onChange, min, placeholder = "Pick a date", devOpen = false, devJump = false }: { label: string; value: string; onChange: (iso: string) => void; min?: string; placeholder?: string; devOpen?: boolean; devJump?: boolean }) {
  const [open, setOpen] = useState(devOpen); // devOpen/devJump: DEV-only, for screenshots and tests
  useEffect(() => { if (devOpen) { Keyboard.dismiss(); setOpen(true); } }, [devOpen]);
  useFocusEffect(useCallback(() => () => setOpen(false), [])); // never leave the sheet up over another screen
  return (
    <View>
      <ZText variant="captionStrong" style={styles.label}>{label}</ZText>
      <Press
        onPress={() => { Keyboard.dismiss(); setOpen(true); }}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDateLong(value) : placeholder}`}
        accessibilityState={{ expanded: open }}
        style={[styles.pill, { borderColor: open ? color.text : color.outline }]}
      >
        <ZText variant="body" color={value ? color.text : color.textMuted} numberOfLines={1} style={styles.flex}>{value ? formatDateLong(value) : placeholder}</ZText>
        <Icon name="chevronDown" size={16} color={color.textMuted} />
      </Press>
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
    <BottomSheet open={visible} onClose={onClose}>
      <ZText variant="captionStrong" color={color.textMuted} style={styles.center}>{title}</ZText>

      {/* header: ‹  Month Year  › */}
      <View style={styles.header}>
        <IconButton name="chevronLeft" label="Previous month" onPress={() => setYm((m) => clampMonth(shiftMonth(m, -1), anchor))} disabled={!canPrev} style={[styles.chevron, !canPrev ? styles.dim : null]} />
        <Press onPress={() => { Keyboard.dismiss(); setJump((v) => !v); }} scaleTo={0.97} accessibilityRole="button" accessibilityState={{ expanded: jump }} accessibilityLabel="Choose month" hitSlop={8} style={[styles.monthButton, jump ? styles.monthButtonOn : null]}>
          <ZText variant="headline">{monthLabel(ym)}</ZText>
          <Icon name={jump ? "chevronUp" : "chevronDown"} size={16} color={color.textMuted} />
        </Press>
        <IconButton name="chevronRight" label="Next month" onPress={() => setYm((m) => clampMonth(shiftMonth(m, 1), anchor))} disabled={!canNext} style={[styles.chevron, !canNext ? styles.dim : null]} />
      </View>

      <View>
        <View style={styles.row}>
          {WEEKDAYS_SHORT.map((w) => <ZText key={w} variant="small" color={color.textMuted} style={styles.weekday}>{w}</ZText>)}
        </View>
        {Array.from({ length: 6 }, (_, r) => (
          <View key={r} style={styles.row}>
            {cells.slice(r * 7, r * 7 + 7).map((c) => {
              const off = disabled(c.iso, c.inMonth), selected = c.iso === value;
              return (
                <Press key={c.iso} disabled={off} onPress={() => onPick(c.iso)} scaleTo={0.97} accessibilityRole="button" accessibilityState={{ disabled: off, selected }} accessibilityLabel={formatDateLong(c.iso)} style={styles.cell}>
                  <View style={[styles.day, selected ? styles.daySelected : c.isToday ? styles.dayToday : null]}>
                    <ZText variant={selected || c.isToday ? "captionStrong" : "caption"} color={selected ? color.textOnInk : off ? color.textMuted : color.text} style={off && !c.inMonth ? styles.faint : null}>{c.day}</ZText>
                  </View>
                </Press>
              );
            })}
          </View>
        ))}

        {/* month jump: an overlay over the grid */}
        {jump ? (
          <View style={styles.jumpHost}>
            <Pressable style={styles.jumpBackdrop} onPress={() => setJump(false)} accessibilityLabel="Close month list" accessibilityRole="button" />
            <View style={styles.jumpCard}>
              <ZText variant="overline" color={color.textMuted} style={styles.center}>Jump to</ZText>
              <View style={styles.jumpGrid}>
                {monthRange(anchor).map((m) => {
                  const on = compareMonth(m, ym) === 0, isNow = compareMonth(m, anchor) === 0;
                  return (
                    <Press key={`${m.year}-${m.month}`} onPress={() => { setYm(m); setJump(false); }} scaleTo={0.97} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={monthLabel(m)}
                      style={[styles.jumpPill, on ? styles.jumpPillOn : isNow ? styles.jumpPillNow : null]}>
                      <ZText variant="captionStrong" color={on ? color.textOnInk : color.text}>{monthLabel(m, false).slice(0, 3)}</ZText>
                      <ZText variant="small" color={on ? color.accentOnInk : color.textMuted}>{m.year}</ZText>
                    </Press>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </View>
      <ZText variant="small" color={color.textMuted} style={styles.center}>{min ? `From ${formatDateLong(min)}` : "Tap a day"}</ZText>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { marginBottom: 6, marginLeft: 4 },
  pill: { backgroundColor: palette.white, borderWidth: 1.5, borderRadius: radius.pill, minHeight: size.buttonHeight, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: space[8] },
  center: { textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: space[12] },
  chevron: { shadowOpacity: 0, borderWidth: 1.5, borderColor: color.outline },
  dim: { opacity: 0.35 },
  monthButton: { flexDirection: "row", alignItems: "center", gap: space[6], paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, minHeight: size.pillButton },
  monthButtonOn: { backgroundColor: color.surfaceInset },
  row: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", paddingVertical: 4 },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: palette.ink },
  dayToday: { borderWidth: 1.5, borderColor: color.outlineDashed },
  faint: { opacity: 0.5 },
  jumpHost: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  jumpBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.surfaceTranslucentStrong },
  jumpCard: { width: "92%", borderRadius: radius.card, borderWidth: 1.5, borderColor: color.outline, backgroundColor: palette.white, padding: space[12], gap: space[10] },
  jumpGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[8], justifyContent: "center" },
  jumpPill: { width: "30%", paddingVertical: 8, alignItems: "center", borderRadius: radius.tile, backgroundColor: color.surfaceInset, borderWidth: 1.5, borderColor: "transparent" },
  jumpPillOn: { backgroundColor: palette.ink },
  jumpPillNow: { borderColor: color.outlineDashed },
});
