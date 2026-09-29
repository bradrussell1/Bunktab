import { theme } from "@checkm8/theme";
import { useCallback, useRef, useState, type ReactElement } from "react";
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

/**
 * Horizontal rotary carousel for chips (categories, subcategories, members).
 * When every item fits in the row they are simply centred; when they
 * overflow, the list is rendered three times and the scroll position is
 * re-centred after each fling, so it loops in both directions with no end.
 * Snaps to item edges (measured, so items may differ in width). Works from
 * 2 to 20+ items.
 */
export function RotaryCarousel<T>({ items, keyOf, renderItem, gap = theme.spacing.sm, disabled = false, style }: {
  items: T[];
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactElement;
  gap?: number;
  disabled?: boolean;
  style?: object;
}) {
  const ref = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const widths = useRef<number[]>([]);
  const [setWidthPx, setSetWidthPx] = useState(0); // width of one copy of the list
  const centred = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const measure = (i: number) => (e: LayoutChangeEvent) => {
    widths.current[i] = e.nativeEvent.layout.width;
    if (widths.current.filter((w) => w !== undefined).length === items.length) {
      setSetWidthPx(widths.current.reduce((a, b) => a + b, 0) + gap * items.length);
    }
  };

  const loop = setWidthPx > width && width > 0 && !disabled;
  const copies = loop ? 3 : 1;

  // jump to the middle copy once we know the size
  const onContentSizeChange = useCallback(() => {
    if (loop && !centred.current) { ref.current?.scrollTo({ x: setWidthPx, animated: false }); centred.current = true; }
  }, [loop, setWidthPx]);

  const recentre = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!loop) return;
    const x = e.nativeEvent.contentOffset.x;
    if (x < setWidthPx * 0.5) ref.current?.scrollTo({ x: x + setWidthPx, animated: false });
    else if (x > setWidthPx * 1.5) ref.current?.scrollTo({ x: x - setWidthPx, animated: false });
  };

  // snap offsets: item starts across all copies
  const offsets: number[] = [];
  if (loop) { let acc = 0; for (let c = 0; c < copies; c++) for (let i = 0; i < items.length; i++) { offsets.push(acc); acc += (widths.current[i] ?? 0) + gap; } }

  return (
    <View onLayout={onLayout} style={style}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={loop}
        decelerationRate="fast"
        snapToOffsets={loop ? offsets : undefined}
        snapToAlignment="start"
        onContentSizeChange={onContentSizeChange}
        onMomentumScrollEnd={recentre}
        onScrollEndDrag={recentre}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ gap, alignItems: "center" }, !loop && { flexGrow: 1, justifyContent: "center", paddingHorizontal: gap }]}
      >
        {Array.from({ length: copies }, (_, c) =>
          items.map((it, i) => (
            <View key={`${c}:${keyOf(it, i)}`} onLayout={c === 0 ? measure(i) : undefined}>
              {renderItem(it, i)}
            </View>
          )),
        )}
      </ScrollView>
    </View>
  );
}
