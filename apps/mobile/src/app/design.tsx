/**
 * DEV-only design sheet: every primitive in every state, the seven zebra moods, the full
 * zebra at 0/3/6 of 6, 2 of 4, 7 of 10, and every animation with a replay button.
 * Open with exp://<lan-ip>:8081/--/design. Not registered in production builds.
 */
import { color, layout, palette, space, radius } from "@bunktab/theme";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionSheet, AmountPill, Avatar, AvatarRow, Banner, Boop, BottomSheet, Button, Card, Chip, Confetti, ContextPill, CountUp, Dance, HeroCard, Icon, IconButton, InsetPanel, Input, LiveDot, Money, MoonPop, NightCell, PersonPill, Receipt, Rise, RowCard, ScreenBackground, SegmentedControl, SpeechBubble, StatusPill, StripeGrow, StripeMeter, TextArea, Toggle, TopBar, Twinkle, VenmoZipButton, Zebra, ZText, ZzFloat, useToast, ErrorPanel, HeroSkeleton, RowSkeleton, type IconName,
} from "@/ui";

const MOODS = ["hi", "happy", "wink", "sleepy", "starry", "love", "worried"] as const;
const ICONS: IconName[] = ["chevronLeft", "chevronRight", "chevronDown", "chevronUp", "plus", "search", "person", "more", "camera", "check", "close", "link", "moon", "send", "share", "bell"];

const sectionYs: Record<string, number> = {};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section} onLayout={(e) => { sectionYs[title] = e.nativeEvent.layout.y; }}>
      <ZText variant="overline" color={color.textMuted}>{title}</ZText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export default function DesignSheet() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Sheet />;
}

function Sheet() {
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  // ?at=<section title prefix> scrolls there on open (used for screenshots).
  const { at } = useLocalSearchParams<{ at?: string }>();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (!at) return;
    const t = setTimeout(() => {
      const key = Object.keys(sectionYs).find((k) => k.toLowerCase().startsWith(String(at).toLowerCase()));
      if (key != null) scroll.current?.scrollTo({ y: sectionYs[key] - 8, animated: false });
    }, 600);
    return () => clearTimeout(t);
  }, [at]);
  const [seg, setSeg] = useState<"open" | "past">("open");
  const [tabs, setTabs] = useState<"expenses" | "people" | "summary">("expenses");
  const [on, setOn] = useState(false);
  const [night, setNight] = useState([true, true, false, true, false]);
  const [done, setDone] = useState(3);
  const [members, setMembers] = useState(6);
  const [mood, setMood] = useState<(typeof MOODS)[number]>("hi");
  const [sheet, setSheet] = useState(false);
  const [actions, setActions] = useState(false);
  const [play, setPlay] = useState({ dance: 0, confetti: 0, rise: 0, receipt: 0, count: 0, moon: 0, boop: 0, stripe: true, swipe: true });
  const [paid, setPaid] = useState(false);
  const [text, setText] = useState("");
  const replay = (k: keyof typeof play) => setPlay((p) => ({ ...p, [k]: typeof p[k] === "number" ? (p[k] as number) + 1 : !p[k] }));

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar wordmark right={<><IconButton name="search" label="Search" /><IconButton name="person" label="Profile" /></>} />
      <ScrollView ref={scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}>
        <ZText variant="title1">Design sheet</ZText>
        <ZText variant="caption" color={color.textMuted}>Zebrasplit design system v1.0 · every primitive, every state · DEV only</ZText>

        <Section title="Type scale">
          {(["wordmark", "display", "amountL", "title1", "title2", "headline", "button", "buttonS", "body", "bodyStrong", "label", "caption", "captionStrong", "small", "micro", "overline"] as const).map((v) => (
            <ZText key={v} variant={v} tabular={v === "display" || v === "amountL"}>{v === "display" || v === "amountL" ? "$2,193.10" : v === "wordmark" ? "zebrasplit" : `${v} · Split the trip. Keep it black and white.`}</ZText>
          ))}
          <Money cents={219310} variant="amountRow" /><Money cents={-14250} /><Money cents={0} />
        </Section>

        <Section title="Buttons">
          <Button label="Start a dazzle" icon="plus" onPress={() => show({ message: "Invites sent", bust: <Zebra variant="bust" mood="wink" size={28} decorative /> })} />
          <Button label="Close out" kind="ink" onPress={() => {}} />
          <Button label="Snap a receipt" kind="ink" icon="camera" onPress={() => {}} />
          <Button label="Try again" kind="secondary" onPress={() => {}} />
          <Card><Button label="Secondary on white" kind="secondary" onWhite onPress={() => {}} /></Card>
          <Button label="Close out · 3 to go" kind="locked" />
          <Button label="Saving…" loading />
          <Row><Button label="Nudge" kind="nudge" onPress={() => replay("boop")} /><Button label="Check it" kind="secondary" height={40} onPress={() => {}} /></Row>
          <Row>{ICONS.slice(0, 8).map((n) => <IconButton key={n} name={n} label={n} />)}</Row>
          <Row>{ICONS.slice(8).map((n) => <IconButton key={n} name={n} label={n} />)}</Row>
          <Row>{ICONS.map((n) => <Icon key={n} name={n} size={20} />)}</Row>
        </Section>

        <Section title="Pills and chips">
          <Row><AmountPill cents={219310} /><AmountPill cents={-14250} /><AmountPill cents={0} /><AmountPill cents={69090} large /></Row>
          <Row><StatusPill label="3 of 6 stripes" /><StatusPill label="All 6 stripes" complete /><ContextPill>Casa Azul villa · $3,000</ContextPill></Row>
          <Row><Chip label="Jess" onRemove={() => {}} /><Chip label="Jordan" onRemove={() => {}} /><Chip label="Priya" /></Row>
        </Section>

        <Section title="Cards">
          <HeroCard>
            <ZText variant="caption" color={color.textMuted}>Across 3 dazzles</ZText>
            <CountUp cents={219310} play={play.count} />
            <AmountPill cents={219310} large style={{ marginTop: 8 }} />
            <View style={styles.heroZebra}><Zebra variant="bust" mood="happy" size={112} animate={{ bob: true }} decorative /></View>
          </HeroCard>
          <Card onPress={() => {}}>
            <ZText variant="headline">Cabo crew: Casa Azul</ZText>
            <ZText variant="caption" color={color.textMuted}>Oct 9 – 14 · 6 in the dazzle</ZText>
            <InsetPanel style={{ marginTop: 10 }}><StripeMeter members={6} done={3} /></InsetPanel>
          </Card>
          <RowCard tile={<Icon name="moon" />} title="Casa Azul villa" caption="You paid · split by nights stayed" right={<><Money cents={300000} /><AmountPill cents={-50000} /></>} onPress={() => {}} />
          <InsetPanel><ZText variant="caption"><ZText variant="captionStrong">3 of 6 stripes.</ZText> Jess, Jordan, Bradley still adding.</ZText></InsetPanel>
          <InsetPanel tone="blush"><Row><Zebra variant="bust" mood="worried" size={30} decorative /><ZText variant="caption" color={color.error}>$120.00 unclaimed</ZText></Row></InsetPanel>
        </Section>

        <Section title="Controls">
          <SegmentedControl options={[{ key: "open", label: "Open" }, { key: "past", label: "Past" }]} value={seg} onChange={setSeg} />
          <SegmentedControl options={[{ key: "expenses", label: "Expenses" }, { key: "people", label: "People" }, { key: "summary", label: "Summary" }]} value={tabs} onChange={setTabs} />
          <Row><Toggle value={on} onChange={setOn} label="I'm done adding expenses" /><ZText variant="bodyStrong">{on ? "Done adding" : "Still adding"}</ZText></Row>
          <Input label="Phone number" placeholder="(555) 555-0100" keyboardType="phone-pad" />
          <Input label="Venmo username" placeholder="@bradley" value={text} onChangeText={setText} error={text.length > 0 && !text.startsWith("@") ? "Starts with @" : null} />
          <TextArea label="Description" placeholder="Four nights at the villa" counter={{ value: 12, max: 250 }} />
          <Input label="Locked" value="Read only" editable={false} />
        </Section>

        <Section title="Stripes, nights, avatars, people">
          <StripeMeter members={6} done={done} />
          <StripeMeter members={6} done={6} allInk label="Settled" />
          <StripeMeter members={10} done={7} />
          <Row>{night.map((n, i) => <NightCell key={i} on={n} label={`Night ${i + 1}`} onPress={() => setNight((v) => v.map((x, j) => (j === i ? !x : x)))} />)}</Row>
          <Row><Avatar name="Bradley Russell" /><Avatar name="Jess Park" done /><Avatar name="Jordan Lee" notDone /><Avatar name="Mike Chen" size={26} /></Row>
          <AvatarRow><Avatar name="Bradley Russell" onHero done /><Avatar name="Jess Park" onHero /><Avatar name="Jordan Lee" onHero notDone /><Avatar name="Priya Patel" onHero done /></AvatarRow>
          <PersonPill name="Mike Chen" done stripeIndex={3} bust={<Zebra variant="bust" mood="happy" size={44} decorative />} />
          <PersonPill name="Jordan Lee" done={false} action={<Button label="Nudge" kind="nudge" onPress={() => replay("boop")} />} />
          <PersonPill name="Bradley Russell" isYou done={false} onPress={() => {}} />
        </Section>

        <Section title="Overlays">
          <Row>
            <Button label="Toast" kind="secondary" height={40} onPress={() => show({ message: "Jordan earned their stripe. 5 of 6.", action: { label: "Undo", onPress: () => {} } })} />
            <Button label="Sheet" kind="secondary" height={40} onPress={() => setSheet(true)} />
            <Button label="Actions" kind="secondary" height={40} onPress={() => setActions(true)} />
          </Row>
          <SpeechBubble>psst, add your receipts</SpeechBubble>
          <SpeechBubble tone="white">Did anyone grab the tip?</SpeechBubble>
          <SpeechBubble tone="cream">Yep, $40 on the villa dinner.</SpeechBubble>
          <Banner>Offline. Changes will sync.</Banner>
          <Banner dot="pink">Jordan hasn&apos;t added anything yet</Banner>
          <Row><LiveDot /><ZText variant="caption" color={color.textMuted}>live</ZText></Row>
        </Section>

        <Section title="System UI">
          <Row>
            <Button label="Volt toast" kind="secondary" height={40} onPress={() => show({ message: "Synced", tone: "volt", duration: 2000 })} />
            <Button label="Toast + action" kind="secondary" height={40} onPress={() => show({ message: "Expense deleted", action: { label: "Undo", onPress: () => {} } })} />
          </Row>
          <ErrorPanel message="Couldn't load the dazzle. Check your connection." onRetry={() => {}} />
          <HeroSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </Section>
        <Section title="Receipt">
          <Row><Button label="Print again" kind="secondary" height={40} onPress={() => replay("receipt")} /></Row>
          <Receipt key={play.receipt} merchant="Taqueria El Fogón" lines={[{ label: "Tacos al pastor ×6", cents: 7200 }, { label: "Micheladas ×4", cents: 4800 }, { label: "Tip", cents: 4400 }]} totalCents={16400} />
        </Section>

        <Section title="The zebra · seven moods">
          <Row>{MOODS.map((m) => <Zebra key={m} variant="bust" mood={m} size={88} animate={{ blink: true }} />)}</Row>
          <SegmentedControl options={MOODS.map((m) => ({ key: m, label: m }))} value={mood} onChange={setMood} />
          <Row><Zebra variant="bust" mood={mood} size={160} animate={{ blink: true }} /><Zebra variant="full" mood={mood} members={6} done={3} size={200} animate={{ blink: true, swish: true }} /></Row>
        </Section>

        <Section title="The zebra · stripes">
          <Row><Zebra variant="full" members={6} done={0} size={150} /><Zebra variant="full" members={6} done={3} mood="happy" size={150} /><Zebra variant="full" members={6} done={6} mood="starry" size={150} /></Row>
          <Row><Zebra variant="full" members={4} done={2} mood="happy" size={150} /><Zebra variant="full" members={10} done={7} mood="happy" size={150} /></Row>
          <Row>
            <Button label="− done" kind="secondary" height={40} onPress={() => setDone((d) => Math.max(0, d - 1))} />
            <Button label="+ done" kind="secondary" height={40} onPress={() => setDone((d) => Math.min(members, d + 1))} />
            <Button label={`members ${members}`} kind="secondary" height={40} onPress={() => setMembers((m) => (m >= 14 ? 2 : m + 1))} />
          </Row>
          <View style={styles.stage}>
            <Dance play={play.dance}><Zebra variant="full" members={members} done={done} mood={done >= members ? "starry" : done * 2 >= members ? "happy" : "hi"} size={244} animate={{ blink: true, swish: true }} /></Dance>
            <Confetti play={play.confetti} />
          </View>
          <Row><Button label="Dance" kind="secondary" height={40} onPress={() => replay("dance")} /><Button label="Confetti" kind="secondary" height={40} onPress={() => replay("confetti")} /><Button label="Both" kind="secondary" height={40} onPress={() => { replay("dance"); replay("confetti"); }} /></Row>
        </Section>

        <Section title="Motion · replay each">
          <Row><Button label="Stripe grow" kind="secondary" height={40} onPress={() => replay("stripe")} /><StripeGrow on={play.stripe}><View style={styles.bigStripe} /></StripeGrow></Row>
          <Row><Button label="Count up" kind="secondary" height={40} onPress={() => replay("count")} /><CountUp cents={69090} variant="amountL" play={play.count} /></Row>
          <Row><Button label="Rise" kind="secondary" height={40} onPress={() => replay("rise")} /><Rise key={play.rise}><Card><ZText variant="bodyStrong">Mike pays you $690.90</ZText></Card></Rise></Row>
          <Row><Button label="Moon pop" kind="secondary" height={40} onPress={() => replay("moon")} /><MoonPop play={play.moon}><Twinkle><Icon name="moon" size={28} /></Twinkle></MoonPop></Row>
          <Row><ZzFloat><ZText variant="title2">z</ZText></ZzFloat><Twinkle><ZText variant="title2">☾</ZText></Twinkle><LiveDot size={10} /></Row>
          <VenmoZipButton label="Pay Mike $84.50 in Venmo" paid={paid} onPress={() => setTimeout(() => setPaid(true), 1800)} />
          <Row><Button label="Reset pay" kind="secondary" height={40} onPress={() => setPaid(false)} /><Zebra variant="bust" mood={paid ? "love" : "hi"} size={84} animate={{ blink: true }} /></Row>
          <View style={styles.boopStage}>
            <Boop play={play.boop} bubble={<SpeechBubble>psst, add your receipts</SpeechBubble>}><Zebra variant="bust" mood="happy" size={92} decorative /></Boop>
            <Avatar name="Jordan Lee" notDone />
          </View>
        </Section>
      </ScrollView>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Add expense">
        <Input placeholder="$0.00" keyboardType="decimal-pad" />
        <View style={{ height: space[12] }} />
        <Button label="Add expense" onPress={() => setSheet(false)} />
      </BottomSheet>
      <ActionSheet open={actions} onClose={() => setActions(false)} title="Cabo crew" actions={[{ label: "Edit dazzle", onPress: () => {} }, { label: "Members", onPress: () => {} }, { label: "Close out anyway", onPress: () => {}, destructive: true }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: space[12] },
  section: { gap: space[10], marginTop: space[20] },
  sectionBody: { gap: space[10] },
  row: { flexDirection: "row", alignItems: "center", gap: space[10], flexWrap: "wrap" },
  heroZebra: { position: "absolute", right: -2, bottom: -12 },
  stage: { alignItems: "center", justifyContent: "center", paddingVertical: space[20], backgroundColor: palette.white, borderRadius: radius.hero, overflow: "visible" },
  bigStripe: { width: 16, height: 60, borderRadius: radius.stripe, backgroundColor: palette.ink, transform: [{ rotate: "10deg" }] },
  boopStage: { alignItems: "center", paddingTop: 120, paddingBottom: 10 },
});
