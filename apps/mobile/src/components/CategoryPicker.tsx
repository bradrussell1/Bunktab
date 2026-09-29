import { CATEGORIES } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "./ui";

/**
 * Category + subcategory as two stacked horizontal selectors (spec:
 * Categories, two linked dropdowns). Row 1 is the fixed top-level list;
 * row 2 shows the chosen category's subcategories and stays greyed out
 * until a category is picked. Categories with no subcategories show a
 * single muted "No subcategory" chip. Nothing is selected by default.
 */
export function CategoryPicker({ category, subcategory, onChange }: { category: string | null; subcategory: string | null; onChange: (category: string | null, subcategory: string | null) => void }) {
  const cat = CATEGORIES.find((c) => c.key === category) ?? null;
  const row1 = useRef<ScrollView>(null);
  const xs = useRef<Record<string, number>>({});

  // keep the selected top-level chip in view (editing an existing expense)
  useEffect(() => {
    if (category && xs.current[category] !== undefined) row1.current?.scrollTo({ x: Math.max(0, xs.current[category]! - 16), animated: false });
  }, [category]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Category</Text>
      <ScrollView ref={row1} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.screenPadding }} keyboardShouldPersistTaps="handled">
        {CATEGORIES.map((c) => (
          <View key={c.key} onLayout={(e) => { xs.current[c.key] = e.nativeEvent.layout.x; }}>
            <Chip label={c.label} on={category === c.key} onPress={() => onChange(c.key, null)} />
          </View>
        ))}
      </ScrollView>

      <Text variant="caption1Semibold" color={cat ? theme.colors.text.onBackground.secondary : theme.colors.text.onBackground.tertiary}>Subcategory</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingRight: theme.screenPadding }} keyboardShouldPersistTaps="handled" scrollEnabled={!!cat && cat.subcategories.length > 0}>
        {!cat && ["Pick a category first", "…", "…"].map((l, i) => <Chip key={i} label={l} on={false} muted />)}
        {cat && cat.subcategories.length === 0 && <Chip label="No subcategory" on={false} muted />}
        {cat && cat.subcategories.map((s) => <Chip key={s.key} label={s.label} on={subcategory === s.key} onPress={() => onChange(cat.key, s.key)} />)}
      </ScrollView>
    </View>
  );
}

function Chip({ label, on, onPress, muted }: { label: string; on: boolean; onPress?: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={muted || !onPress} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: muted }}
      style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.pill, borderWidth: 1, opacity: muted ? 0.4 : 1, borderColor: on ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : theme.colors.background.surface }}>
      <Text variant="caption1Semibold" color={muted ? theme.colors.text.onBackground.tertiary : on ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.primary}>{label}</Text>
    </Pressable>
  );
}
