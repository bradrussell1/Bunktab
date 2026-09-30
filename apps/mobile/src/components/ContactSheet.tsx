import { theme } from "@checkm8/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, PanResponder, Pressable, View, type LayoutChangeEvent, type ViewToken } from "react-native";
import { Avatar, Button, Input, Text } from "@/components/ui";
import type { Person } from "@/lib/friends";

/**
 * People picker (spec: Create trip → Invite; user: "Invite your friends" and
 * "Select from contacts" open the same pop-up). A bottom sheet with a search
 * field, an endless vertical list sectioned by first letter with sticky
 * headers, and an A–Z rail on the right: tap or drag a letter to jump, and a
 * floating bubble shows where you are. Multi-select with an "Add N people"
 * button. Fixed row heights (getItemLayout) so it scales to thousands.
 */
const HEADER_H = 28;
const ROW_H = 60;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

type Row = { kind: "header"; key: string; letter: string } | { kind: "person"; key: string; person: Person; letter: string };

function letterOf(name: string): string {
  const c = (name.trim()[0] ?? "#").toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export function ContactSheet({ visible, title, people, loading, emptyText, initialSelected, onClose, onConfirm, sheetHeight = 0.86 }: {
  visible: boolean;
  title: string;
  people: Person[];
  loading?: boolean;
  emptyText?: string;
  initialSelected: string[];            // Person.id values already picked
  onClose: () => void;
  onConfirm: (selected: Person[]) => void;
  sheetHeight?: number;                 // fraction of the screen
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [current, setCurrent] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);
  const railTop = useRef(0);
  const railHeight = useRef(1);

  useEffect(() => { if (visible) { setSelected(new Set(initialSelected)); setQuery(""); } }, [visible, initialSelected]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const shown = people.filter((p) => !q || p.name.toLowerCase().includes(q) || (digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits)));
    const out: Row[] = [];
    let last = "";
    for (const p of shown) {
      const l = letterOf(p.name);
      if (l !== last) { out.push({ kind: "header", key: `h:${l}`, letter: l }); last = l; }
      out.push({ kind: "person", key: `p:${p.id}`, person: p, letter: l });
    }
    return out;
  }, [people, query]);

  const offsets = useMemo(() => { let y = 0; return rows.map((r) => { const o = y; y += r.kind === "header" ? HEADER_H : ROW_H; return o; }); }, [rows]);
  const stickyIndices = useMemo(() => rows.map((r, i) => (r.kind === "header" ? i : -1)).filter((i) => i >= 0), [rows]);
  const present = useMemo(() => new Set(rows.filter((r) => r.kind === "header").map((r) => r.letter)), [rows]);
  const headerIndex = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r, i) => { if (r.kind === "header") m.set(r.letter, i); }); return m; }, [rows]);

  const jumpTo = useCallback((letter: string) => {
    // nearest present letter at or after the one touched
    const order = LETTERS.indexOf(letter);
    const target = LETTERS.slice(order).find((l) => present.has(l)) ?? [...LETTERS].reverse().find((l) => present.has(l));
    if (!target) return;
    const idx = headerIndex.get(target);
    if (idx === undefined) return;
    setCurrent(target);
    listRef.current?.scrollToOffset({ offset: offsets[idx] ?? 0, animated: false });
  }, [present, headerIndex, offsets]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { setDragging(true); jumpTo(LETTERS[Math.min(LETTERS.length - 1, Math.max(0, Math.floor(((e.nativeEvent.locationY) / railHeight.current) * LETTERS.length)))]!); },
    onPanResponderMove: (e) => { jumpTo(LETTERS[Math.min(LETTERS.length - 1, Math.max(0, Math.floor(((e.nativeEvent.locationY) / railHeight.current) * LETTERS.length)))]!); },
    onPanResponderRelease: () => setDragging(false),
    onPanResponderTerminate: () => setDragging(false),
  }), [jumpTo]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
    const first = viewableItems.find((v) => v.isViewable)?.item;
    if (first) setCurrent(first.letter);
  }).current;

  const toggle = (p: Person) => setSelected((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; });
  const count = [...selected].filter((id) => people.some((p) => p.id === id)).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.system.dimming40 }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ height: `${Math.round(sheetHeight * 100)}%`, backgroundColor: theme.colors.background.elevated, borderTopLeftRadius: theme.radius.hero, borderTopRightRadius: theme.radius.hero, paddingTop: theme.spacing.sm, ...theme.elevation.sm }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border.neutral, marginBottom: theme.spacing.sm }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.screenPadding }}>
          <Button title="Cancel" kind="text" size="small" onPress={onClose} />
          <Text variant="title2">{title}</Text>
          <View style={{ width: 64 }} />
        </View>
        <View style={{ paddingHorizontal: theme.screenPadding, paddingVertical: theme.spacing.sm }}>
          <Input placeholder="Search by name or number" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
        </View>

        <View style={{ flex: 1 }}>
          {loading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={theme.colors.text.onBackground.accent} /></View>
          ) : rows.length === 0 ? (
            <View style={{ padding: theme.spacing.xxl }}><Text variant="body" color={theme.colors.text.onBackground.secondary} style={{ textAlign: "center" }}>{query ? "No one matches that." : emptyText ?? "Nobody here yet."}</Text></View>
          ) : (
            <FlatList
              ref={listRef}
              data={rows}
              keyExtractor={(r) => r.key}
              getItemLayout={(_, i) => ({ length: rows[i]?.kind === "header" ? HEADER_H : ROW_H, offset: offsets[i] ?? 0, index: i })}
              stickyHeaderIndices={stickyIndices}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              windowSize={7}
              contentContainerStyle={{ paddingRight: 28, paddingBottom: 96 }}
              renderItem={({ item }) => item.kind === "header" ? (
                <View style={{ height: HEADER_H, justifyContent: "center", paddingHorizontal: theme.screenPadding, backgroundColor: theme.colors.background.elevated }}>
                  <Text variant="captionCaps2" color={theme.colors.text.onBackground.accent}>{item.letter}</Text>
                </View>
              ) : (
                <PersonRow person={item.person} on={selected.has(item.person.id)} onPress={() => toggle(item.person)} />
              )}
            />
          )}

          {/* A–Z rail */}
          {!loading && present.size > 0 && (
            <View style={{ position: "absolute", right: 2, top: 0, bottom: 0, width: 24, justifyContent: "center" }} onLayout={(e: LayoutChangeEvent) => { railTop.current = e.nativeEvent.layout.y; }}>
              <View {...pan.panHandlers} onLayout={(e) => { railHeight.current = e.nativeEvent.layout.height || 1; }} style={{ alignItems: "center", paddingVertical: 4 }}>
                {LETTERS.map((l) => (
                  <Text key={l} variant="caption3" color={present.has(l) ? (l === current ? theme.colors.text.onBackground.accent : theme.colors.text.onBackground.secondary) : theme.colors.text.onBackground.tertiary} style={{ lineHeight: 13, fontSize: 10, opacity: present.has(l) ? 1 : 0.35 }}>{l}</Text>
                ))}
              </View>
            </View>
          )}
          {(dragging) && current && (
            <View pointerEvents="none" style={{ position: "absolute", right: 40, top: "42%", width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.fill.primary, alignItems: "center", justifyContent: "center", ...theme.elevation.sm }}>
              <Text variant="largeTitle" color={theme.colors.text.onFill.onPrimary} style={{ fontSize: 26, lineHeight: 30 }}>{current}</Text>
            </View>
          )}
        </View>

        <View style={{ padding: theme.screenPadding, paddingBottom: 28, borderTopWidth: 1, borderTopColor: theme.colors.divider.default, backgroundColor: theme.colors.background.elevated }}>
          <Button title={count === 0 ? "Add people" : `Add ${count} ${count === 1 ? "person" : "people"}`} disabled={count === 0} onPress={() => onConfirm(people.filter((p) => selected.has(p.id)))} />
        </View>
      </View>
    </Modal>
  );
}

function PersonRow({ person, on, onPress }: { person: Person; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={({ pressed }) => ({ height: ROW_H, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.screenPadding, backgroundColor: pressed ? theme.colors.fill.secondary : "transparent" })}>
      <Avatar name={person.name} uri={person.photo} size={36} />
      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>{person.name}</Text>
        {(person.subtitle || person.phone) && <Text variant="caption1" color={theme.colors.text.onBackground.secondary} numberOfLines={1}>{person.subtitle ?? person.phone}</Text>}
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
        {on && <Text variant="caption3" color={theme.colors.text.onFill.onPrimary}>✓</Text>}
      </View>
    </Pressable>
  );
}
