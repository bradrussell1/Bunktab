import { addDays, divideEvenly, formatCents, weekdayIndex, zebraMoodFor } from "@bunktab/core";
import { color, fonts, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button, ContextPill, Icon, InsetPanel, MoonPop, NightCell, ScreenBackground, TopBar, Twinkle, Zebra, ZText } from "@/ui";

/**
 * Who slept where (RESKIN_PROMPT B6, board "Who slept where"): a full-screen grid of
 * people × nights. Every night someone stayed is a stripe; tap a cell to add one, tap
 * again to take it back. Each night column shows a twinkling moon, the day, the date
 * and that night's cost per sleeper in a volt pill; the moon pops when its column is
 * tapped. The row's share updates instantly. The check line below the grid reads
 * "$X adds up" (white) or "$Y unclaimed" (blush) when a night has nobody in it, and
 * the bust switches sleepy ↔ worried to match. Edits live in a draft until "Save the
 * stripes" hands them back to the expense sheet; Back discards them.
 *
 * Display-only math here mirrors computeNightsShares (per-night even split, payer
 * first for the remainder cent); the saved shares still come from @bunktab/core.
 */
export type Sleeper = { id: string; name: string; short: string; photo?: string | null };

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function WhoSleptWhere({ context, startDate, nights, totalCents, currency, people, payerId, presence: initial, onSave, onClose }: {
  context: string;
  startDate: string;
  nights: number;
  totalCents: number;
  currency: string;
  people: Sleeper[];
  payerId: string;
  presence: Record<string, boolean[]>;
  onSave: (presence: Record<string, boolean[]>) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initial);
  const [pops, setPops] = useState<number[]>(() => Array.from({ length: nights }, () => 0));

  const stayed = (id: string, i: number) => draft[id]?.[i] ?? true;
  const { perNight, perSleeper, shares, assigned, stripes } = useMemo(() => {
    const perNight = divideEvenly(totalCents, nights);
    const counts = Array.from({ length: nights }, (_, i) => people.filter((p) => stayed(p.id, i)).length);
    const ordered = [...people].sort((a, b) => (a.id === payerId ? -1 : b.id === payerId ? 1 : 0));
    const shares: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]));
    let assigned = 0;
    perNight.forEach((cents, i) => {
      const present = ordered.filter((p) => stayed(p.id, i));
      if (!present.length) return;
      assigned += cents;
      divideEvenly(cents, present.length).forEach((part, k) => { shares[present[k]!.id]! += part; });
    });
    const perSleeper = perNight.map((cents, i) => (counts[i] ? Math.round(cents / counts[i]!) : null));
    return { counts, perNight, perSleeper, shares, assigned, stripes: counts.reduce((a, b) => a + b, 0) };
  }, [draft, people, nights, totalCents, payerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const unclaimed = totalCents - assigned;
  const mood = zebraMoodFor({ place: "nights", unclaimedCents: unclaimed }) ?? "sleepy";

  function toggle(id: string, i: number) {
    setDraft((d) => ({ ...d, [id]: Array.from({ length: nights }, (_, k) => (k === i ? !stayed(id, k) : stayed(id, k))) }));
    setPops((p) => p.map((v, k) => (k === i ? v + 1 : v)));
  }
  const nightDate = (i: number) => addDays(startDate, i);
  const dayLabel = (i: number) => `${DAYS[weekdayIndex(nightDate(i))]} ${Number(nightDate(i).slice(8, 10))}`;
  /** whole-dollar pill ("$600"); exact cents live in the row share */
  const pillMoney = (cents: number) => formatCents(Math.round(cents / 100) * 100, currency).replace(/[.,]00(?!\d)/, "");

  return (
    <View style={styles.host}>
      <ScreenBackground />
      <TopBar onBack={onClose} right={<ContextPill style={styles.context}>{context}</ContextPill>} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <ZText variant="title1" accessibilityRole="header" style={styles.flex}>Who slept where?</ZText>
            <Zebra variant="bust" mood={mood} size={62} animate={{ blink: true }} accessibilityLabel={unclaimed === 0 ? "Zebra, sleepy: every night is claimed" : "Zebra, worried: a night has nobody in it"} style={styles.bust} />
          </View>
          <ZText variant="body" color={color.textSecondary}>Every night you stayed is a stripe. Tap to add one, tap again to take it back.</ZText>
        </View>

        <View style={styles.chips}>
          <Button kind="secondary" height={size.segmentHeight} label="Everyone, every night" onPress={() => setDraft(Object.fromEntries(people.map((p) => [p.id, Array.from({ length: nights }, () => true)])))} />
          <Button kind="secondary" height={size.segmentHeight} label="Back to saved" onPress={() => setDraft(initial)} />
        </View>

        <View style={styles.grid}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridInner} bounces={false}>
            <View>
              <View style={styles.head}>
                <View style={styles.nameCol} />
                {perNight.map((_, i) => (
                  <View key={i} style={styles.nightCol}>
                    <MoonPop play={pops[i] ?? 0}><Twinkle><Icon name="moon" size={14} /></Twinkle></MoonPop>
                    <ZText variant="micro" style={styles.day}>{DAYS[weekdayIndex(nightDate(i))]}</ZText>
                    <ZText variant="micro" color={color.textSecondary}>{Number(nightDate(i).slice(8, 10))}</ZText>
                    <View style={[styles.costPill, perSleeper[i] == null ? styles.costPillEmpty : null]} accessibilityLabel={perSleeper[i] == null ? "Nobody yet" : `${formatCents(perSleeper[i]!, currency)} each`}>
                      <ZText variant="micro" tabular>{perSleeper[i] == null ? "—" : pillMoney(perSleeper[i]!)}</ZText>
                    </View>
                  </View>
                ))}
                <View style={styles.shareCol} />
              </View>
              {people.map((p) => {
                const n = perNight.filter((_, i) => stayed(p.id, i)).length;
                return (
                  <View key={p.id} style={styles.row}>
                    <View style={styles.nameCol}>
                      <Avatar name={p.name} uri={p.photo} size={size.avatarSmall} />
                      <ZText variant="captionStrong" numberOfLines={1} style={styles.flex}>{p.short}</ZText>
                    </View>
                    {perNight.map((_, i) => {
                      const on = stayed(p.id, i);
                      return <NightCell key={i} on={on} label={`${p.name}, ${dayLabel(i)}, ${on ? "stayed" : "not there"}`} onPress={() => toggle(p.id, i)} />;
                    })}
                    <ZText variant="captionStrong" tabular style={styles.shareCol} accessibilityLabel={n ? `${p.name} owes ${formatCents(shares[p.id] ?? 0, currency)} for ${n} ${n === 1 ? "night" : "nights"}` : `${p.name}, no nights`}>{n ? formatCents(shares[p.id] ?? 0, currency) : "—"}</ZText>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]}>
        <InsetPanel tone={unclaimed === 0 ? "cream" : "blush"} style={[styles.check, unclaimed === 0 ? styles.checkWhite : null]}>
          <ZText variant="captionStrong" color={unclaimed === 0 ? color.text : color.youOweText}>{stripes} {stripes === 1 ? "stripe" : "stripes"} over {nights} {nights === 1 ? "night" : "nights"}</ZText>
          <ZText variant="amountRow" tabular color={unclaimed === 0 ? color.text : color.youOweText}>{unclaimed === 0 ? `${formatCents(assigned, currency)} adds up` : `${formatCents(unclaimed, currency)} unclaimed`}</ZText>
        </InsetPanel>
        <Button label="Save the stripes" onPress={() => onSave(draft)} disabled={unclaimed !== 0} accessibilityLabel={unclaimed !== 0 ? "Save the stripes, unavailable until every night has someone in it" : "Save the stripes"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: palette.bgMid },
  flex: { flex: 1 },
  context: { maxWidth: 230 },
  content: { paddingBottom: space[24], gap: space[12] },
  titleBlock: { paddingHorizontal: layout.textGutter, paddingTop: space[4], gap: space[4] },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: space[8] },
  bust: { marginBottom: -6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[8], paddingHorizontal: layout.screenGutter, marginTop: space[2] },
  grid: { marginHorizontal: layout.screenGutter, backgroundColor: color.surfaceTranslucentStrong, borderRadius: radius.hero, paddingTop: 14, paddingBottom: 10, ...shadow.card },
  gridInner: { paddingHorizontal: 12, flexGrow: 1 },
  head: { flexDirection: "row", alignItems: "flex-end", gap: space[4], paddingBottom: space[4] },
  nameCol: { width: 72, flexDirection: "row", alignItems: "center", gap: space[6] },
  nightCol: { width: size.nightCell.width, alignItems: "center", gap: space[2] },
  day: { fontFamily: fonts.extrabold },
  costPill: { backgroundColor: palette.volt, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, minWidth: size.nightCell.width, alignItems: "center" },
  costPillEmpty: { backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", gap: space[4], paddingVertical: 3, borderTopWidth: 1, borderTopColor: color.divider },
  shareCol: { flex: 1, minWidth: 58, textAlign: "right" },
  check: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8], borderRadius: radius.inset + 4, paddingVertical: 12, paddingHorizontal: 16 },
  checkWhite: { backgroundColor: palette.white },
  footer: { paddingHorizontal: layout.screenGutter, paddingTop: space[10], gap: space[12] },
});
