import { color, layout, palette, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, ScreenBackground, TopBar, ZText } from "@/ui";

/** FAQ (placeholder copy until the real answers are written; RESKIN_PROMPT B10 "copy TBD"). */
const FAQ: { q: string; a: string }[] = [
  { q: "Lorem ipsum dolor sit amet?", a: "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation." },
  { q: "Quis nostrud exercitation ullamco?", a: "Laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." },
  { q: "Excepteur sint occaecat cupidatat?", a: "Non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem." },
  { q: "Nemo enim ipsam voluptatem quia?", a: "Voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt." },
  { q: "Neque porro quisquam est qui dolorem?", a: "Ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem." },
];

export default function FaqScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <ZText variant="title1" accessibilityRole="header" style={styles.title}>FAQ</ZText>
        {FAQ.map((f) => (
          <Card key={f.q} style={styles.card}>
            <ZText variant="headline">{f.q}</ZText>
            <ZText variant="body" color={color.textSecondary}>{f.a}</ZText>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  content: { paddingHorizontal: layout.screenGutter, gap: layout.listGap },
  title: { paddingHorizontal: space[4], marginBottom: space[2] },
  card: { gap: space[6] },
});
