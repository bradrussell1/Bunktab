import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { Button, Card, Screen, Text } from "@/components/ui";

/** FAQ (placeholder copy until the real answers are written). */
const FAQ: { q: string; a: string }[] = [
  { q: "Lorem ipsum dolor sit amet?", a: "Consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation." },
  { q: "Quis nostrud exercitation ullamco?", a: "Laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur." },
  { q: "Excepteur sint occaecat cupidatat?", a: "Non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem." },
  { q: "Nemo enim ipsam voluptatem quia?", a: "Voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt." },
  { q: "Neque porro quisquam est qui dolorem?", a: "Ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem." },
];

export default function FaqScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Profile" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">FAQ</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 40 }}>
        {FAQ.map((f) => (
          <Card key={f.q} style={{ gap: theme.spacing.xs }}>
            <Text variant="headline">{f.q}</Text>
            <Text variant="body" color={theme.colors.text.onBackground.secondary}>{f.a}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
