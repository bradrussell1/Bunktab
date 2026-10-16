import { color, layout, palette, radius, space } from "@bunktab/theme";
import { ScrollView, StyleSheet, View } from "react-native";
import { Press, ZText } from "@/ui";

export type Person = { id: string; name: string; short: string; photo?: string | null };

export function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Person picker (Split-by-item board): a row of 42 px avatars with names, Everyone first.
 * Active = ink disc with volt initials and a 2 px ink ring with a cream gap; inactive =
 * white with a hairline. Uses accessibilityState.selected.
 */
export function PersonPicker({ people, active, onPick }: { people: Person[]; active: string; onPick: (id: string) => void }) {
  const all = [{ id: "all", name: "Everyone", short: "Everyone", ini: "ALL" }, ...people.map((p) => ({ ...p, ini: p.id === "you" || p.short === "You" ? "YOU" : initialsOf(p.name) }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker} bounces={false}>
      {all.map((p) => {
        const on = p.id === active;
        return (
          <Press key={p.id} onPress={() => onPick(p.id)} scaleTo={0.97} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Assign dishes to ${p.name}`} style={styles.pickerItem}>
            <View style={[styles.ring, on ? styles.ringOn : null]}>
              <View style={[styles.disc, on ? styles.discOn : null]}>
                <ZText variant="small" color={on ? color.accentOnInk : color.text} style={styles.ini}>{p.ini}</ZText>
              </View>
            </View>
            <ZText variant={on ? "captionStrong" : "small"} color={on ? color.text : color.textMuted} numberOfLines={1}>{p.short}</ZText>
          </Press>
        );
      })}
    </ScrollView>
  );
}

/** Even-split row: selected = ink avatar, name, sub line, share; unselected = dashed avatar, "Not at dinner", "—". */
export function PersonRow({ person, on, sub, amount, onPress, first }: { person: Person; on: boolean; sub: string; amount: string; onPress: () => void; first?: boolean }) {
  return (
    <Press onPress={onPress} scaleTo={0.98} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${person.name}, ${sub}${on ? `, ${amount}` : ""}`} style={[styles.row, first ? null : styles.rowRule]}>
      {on ? <View style={styles.inkDisc}><ZText variant="captionStrong" color={color.textOnInk}>{person.short === "You" ? "YOU" : initialsOf(person.name)}</ZText></View> : <View style={styles.dashed}><ZText variant="captionStrong" color={color.textMuted}>{person.short === "You" ? "YOU" : initialsOf(person.name)}</ZText></View>}
      <View style={styles.rowText}>
        <ZText variant="bodyStrong" color={on ? color.text : color.textMuted} numberOfLines={1}>{person.name}</ZText>
        <ZText variant="small" color={color.textMuted}>{sub}</ZText>
      </View>
      <ZText variant="amountRow" tabular color={on ? color.text : color.outlineDashed}>{amount}</ZText>
    </Press>
  );
}

const styles = StyleSheet.create({
  picker: { paddingHorizontal: layout.screenGutter, gap: space[14], paddingVertical: space[4] },
  pickerItem: { alignItems: "center", gap: 6, width: 60 },
  ring: { padding: 3, borderRadius: radius.pill, borderWidth: 2, borderColor: "transparent" },
  ringOn: { borderColor: palette.ink, backgroundColor: palette.hide },
  disc: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: palette.white, borderWidth: 1.5, borderColor: color.outline, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  ini: { letterSpacing: 0.2 },
  row: { flexDirection: "row", alignItems: "center", gap: space[12], paddingVertical: 10, minHeight: 56 },
  rowRule: { borderTopWidth: 1, borderTopColor: color.divider },
  rowText: { flex: 1, gap: 1 },
  inkDisc: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  dashed: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.outlineDashed, alignItems: "center", justifyContent: "center", backgroundColor: palette.white },
});
