import { CATEGORIES } from "@bunktab/core";
import { theme } from "@bunktab/theme";
import { Pressable, View } from "react-native";
import { RotaryCarousel } from "./RotaryCarousel";
import { Text } from "./ui";

/**
 * Category + subcategory as two stacked rotary carousels (spec: Categories,
 * two linked dropdowns). Row 1 is the fixed top-level list; row 2 shows the
 * chosen category's subcategories and stays greyed out until a category is
 * picked. Categories with no subcategories show a single muted "No
 * subcategory" chip. Nothing is selected by default. Each row loops when it
 * overflows and centres when it doesn't.
 */
export function CategoryPicker({ category, subcategory, onChange }: { category: string | null; subcategory: string | null; onChange: (category: string | null, subcategory: string | null) => void }) {
  const cat = CATEGORIES.find((c) => c.key === category) ?? null;
  const subs = cat ? cat.subcategories : [];
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Category</Text>
      <RotaryCarousel items={[...CATEGORIES]} keyOf={(c) => c.key}
        renderItem={(c) => <Chip label={c.label} on={category === c.key} onPress={() => onChange(c.key, null)} />} />

      <Text variant="caption1Semibold" color={cat ? theme.colors.text.onBackground.secondary : theme.colors.text.onBackground.tertiary}>Subcategory</Text>
      {!cat && (
        <RotaryCarousel items={["Pick a category first", "…", "…"]} keyOf={(l, i) => `${i}`} disabled renderItem={(l) => <Chip label={l} on={false} muted />} />
      )}
      {cat && subs.length === 0 && <RotaryCarousel items={["No subcategory"]} keyOf={(l) => l} disabled renderItem={(l) => <Chip label={l} on={false} muted />} />}
      {cat && subs.length > 0 && (
        <RotaryCarousel key={cat.key} items={[...subs]} keyOf={(s) => s.key}
          renderItem={(s) => <Chip label={s.label} on={subcategory === s.key} onPress={() => onChange(cat.key, s.key)} />} />
      )}
    </View>
  );
}

function Chip({ label, on, onPress, muted }: { label: string; on: boolean; onPress?: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={muted || !onPress} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: muted }}
      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.pill, borderWidth: 1, opacity: muted ? 0.4 : 1, borderColor: on ? theme.colors.fill.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : theme.colors.background.surface }}>
      <Text variant="caption1Semibold" color={muted ? theme.colors.text.onBackground.tertiary : on ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.primary}>{label}</Text>
    </Pressable>
  );
}
