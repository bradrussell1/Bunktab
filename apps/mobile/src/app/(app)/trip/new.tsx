import { COMMON_CURRENCIES, formatPhoneDisplay, toE164 } from "@bunktab/core";
import { color, layout, palette, radius, space } from "@bunktab/theme";
import * as Contacts from "expo-contacts/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { AuthScreen, FormError } from "@/components/AuthScreen";
import { DateField } from "@/components/DatePicker";
import { Avatar, Button, Chip, Icon, Input, Press, RowCard, SegmentedControl, StripeMeter, TextArea, TextLink, Zebra, ZText, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { fetchFriends, type Person } from "@/lib/friends";
import { currencyLabel } from "@/lib/currencyLabels";
import { uploadPrivateImage } from "@/lib/media";
import { pickImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

/**
 * Create a dazzle, two steps (RESKIN_PROMPT B3; spec: Screens → Create trip), with a
 * two-stripe meter as the progress. 1 · Details: title, description (250, with a
 * counter), start and end dates as pill fields, optional cover photo tile, base
 * currency. 2 · Invite: one search field over your Zebrasplit friends (people you've
 * shared a dazzle with) and, once you allow it, your contacts (read on the device
 * only; only the numbers you pick are sent). Typing a number offers it as a row.
 * People who already use Zebrasplit are added straight to the dazzle; everyone
 * else gets one text with a link. Inserts, invites and navigation are unchanged.
 */
type Pick = { phone: string; name: string };

const TERMS = "https://www.zebrasplit.com/terms";
const SMS_INFO = "https://www.zebrasplit.com/sms";
const MAX_ROWS = 60; // the list isn't virtualised; search narrows it

export default function NewTripScreen() {
  const router = useRouter();
  const { show } = useToast();
  const { session, profile } = useAuth();
  const me = session!.user.id;
  const params = useLocalSearchParams<{ step?: string; openDate?: string; jump?: string; consent?: string; demo?: string }>();
  // DEV only: `?step=2` opens the invite step directly (screenshots, tests)
  const [step, setStep] = useState<1 | 2>(__DEV__ && params.step === "2" ? 2 : 1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // DEV only: `?demo=1` pre-fills one invitee and `?consent=1` ticks the box (compliance screenshots)
  const [picks, setPicks] = useState<Pick[]>(__DEV__ && params.demo === "1" ? [{ phone: "+15555550199", name: "(555) 555-0199" }] : []);
  const [agreed, setAgreed] = useState(__DEV__ && params.consent === "1");
  const [busy, setBusy] = useState(false);

  // people: friends load with the step; contacts after permission
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [contacts, setContacts] = useState<Person[] | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  function next() {
    if (title.trim().length === 0) return setError("Give the Dazzle a title.");
    if (!start || !end) return setError("Pick a start and an end date.");
    if (end < start) return setError("The end date can't be before the start.");
    setError(null); setStep(2);
  }

  const loadFriends = useCallback(async () => {
    setPeopleLoading(true); setPeopleError(null);
    try { setFriends(await fetchFriends(me)); } catch (e) { setPeopleError(e instanceof Error ? e.message : "Couldn't load your friends."); setFriends([]); }
    setPeopleLoading(false);
  }, [me]);
  useEffect(() => { if (step === 2 && friends === null) loadFriends(); }, [step, friends, loadFriends]);

  const loadContacts = useCallback(async () => {
    setPeopleLoading(true); setPeopleError(null);
    try {
      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setPeopleError(canAskAgain ? "Contacts permission was declined. You can still type a number." : "Contacts access is off. Turn it on in Settings › Zebrasplit › Contacts, or type a number.");
        setContacts([]); setPeopleLoading(false); return;
      }
      const byPhone = new Map<string, Person>();
      let offset = 0;
      for (;;) {
        const page = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image], pageSize: 500, pageOffset: offset, sort: Contacts.SortTypes.FirstName });
        for (const c of page.data) {
          const name = (c.name ?? [c.firstName, c.lastName].filter(Boolean).join(" ")).trim();
          for (const p of c.phoneNumbers ?? []) {
            const e = toE164(p.number ?? p.digits ?? "");
            if (!e || byPhone.has(e)) continue;
            byPhone.set(e, { id: e, name: name || formatPhoneDisplay(e), phone: e, subtitle: `${formatPhoneDisplay(e)}${p.label ? ` · ${p.label}` : ""}`, photo: c.imageAvailable ? c.image?.uri ?? null : null, kind: "contact" });
          }
        }
        offset += page.data.length;
        if (!page.hasNextPage || page.data.length === 0) break;
      }
      setContacts([...byPhone.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setPeopleError(e instanceof Error ? e.message : "Couldn't read your contacts.");
      setContacts([]);
    }
    setPeopleLoading(false);
  }, []);

  function isMe(e164: string) { const mine = profile?.phone?.replace(/^\+/, ""); return !!mine && e164.replace(/^\+/, "") === mine; }
  const picked = (phone: string) => picks.some((x) => x.phone === phone);
  function toggle(p: Pick) {
    if (isMe(p.phone)) return setError("That's you.");
    setError(null);
    setPicks((ps) => (ps.some((x) => x.phone === p.phone) ? ps.filter((x) => x.phone !== p.phone) : [...ps, p]));
  }

  // friends first, then contacts not already on Zebrasplit; a typed number becomes its own row
  const people = useMemo(() => {
    const seen = new Set<string>();
    const out: Person[] = [];
    for (const p of [...(friends ?? []), ...(contacts ?? [])]) { if (!p.phone || seen.has(p.phone) || isMe(p.phone)) continue; seen.add(p.phone); out.push(p); }
    return out;
  }, [friends, contacts]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const typed = toE164(search);
  const typedRow = typed && !people.some((p) => p.phone === typed) ? typed : null;
  const shown = useMemo(() => people.filter((p) => !q || p.name.toLowerCase().includes(q) || (digits.length >= 3 && (p.phone ?? "").replace(/\D/g, "").includes(digits))), [people, q, digits]);

  async function chooseCover() {
    const uri = await pickImage([16, 9]);
    if (uri) setCoverUri(uri);
  }

  async function finish() {
    if (picks.length > 0 && !agreed) return setError("Agree to the Terms & Conditions to send invites.");
    setBusy(true); setError(null);
    const { data: trip, error: e1 } = await supabase.from("trips").insert({ title: title.trim(), description: description.trim() || null, start_date: start, end_date: end, base_currency: currency, created_by: me }).select("id").single();
    if (e1 || !trip) { setBusy(false); setError(e1?.message ?? "Couldn't start the Dazzle."); return; }
    if (coverUri) {
      // same path and update as the dazzle page's "Change cover"; a failed upload never blocks the dazzle
      try {
        const path = await uploadPrivateImage("covers", `${trip.id}/cover.jpg`, coverUri);
        await supabase.from("trips").update({ cover_photo_url: path }).eq("id", trip.id);
      } catch { /* the Dazzle page offers the cover again */ }
    }
    if (picks.length) {
      const { error: e2 } = await supabase.from("invites").insert(picks.map((p) => ({ trip_id: trip.id, phone: p.phone.replace(/^\+/, ""), invited_by: me })));
      if (e2) { setBusy(false); setError(`Dazzle started, but the invites failed: ${e2.message}`); router.replace(`/(app)/trip/${trip.id}`); return; }
    }
    setBusy(false);
    router.replace(`/(app)/trip/${trip.id}`);
    show({ message: picks.length ? "Invites sent" : "Dazzle started", bust: <Zebra variant="bust" mood="wink" size={28} decorative /> });
  }

  const progress = <StripeMeter members={2} done={step} label={`Step ${step} of 2`} style={styles.progress} />;

  if (step === 1) {
    return (
      <AuthScreen
        onBack={() => router.back()}
        hero={progress}
        title="Start a Dazzle"
        lead="Name it, set the dates, and we'll keep the tab."
        footer={
          <>
            <FormError>{error}</FormError>
            <Button label="Next" onPress={next} />
          </>
        }
      >
        <Input label="Title" placeholder="Cabo crew: Casa Azul" value={title} onChangeText={setTitle} maxLength={80} returnKeyType="done" />
        <TextArea label="Description (optional)" placeholder="Who, where, what to remember" value={description} onChangeText={(v) => setDescription(v.slice(0, 250))} counter={{ value: description.length, max: 250 }} />
        <View style={styles.dates}>
          <View style={styles.flex}><DateField label="Start date" value={start} onChange={(d) => { setStart(d); if (end && end < d) setEnd(""); }} devOpen={__DEV__ && params.openDate === "start"} devJump={__DEV__ && params.jump === "1"} /></View>
          <View style={styles.flex}><DateField label="End date" value={end} onChange={setEnd} min={start || undefined} devOpen={__DEV__ && params.openDate === "end"} /></View>
        </View>
        <Press onPress={chooseCover} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={coverUri ? "Change the cover photo" : "Add a cover photo, optional"} style={styles.coverRow}>
          {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverTile} accessibilityIgnoresInvertColors /> : <View style={styles.coverTile}><Icon name="plus" size={22} /></View>}
          <View style={styles.flex}>
            <ZText variant="bodyStrong">{coverUri ? "Cover photo added" : "Cover photo"}</ZText>
            <ZText variant="small" color={color.textMuted}>{coverUri ? "Tap to change it" : "Optional · shows on the Dazzle"}</ZText>
          </View>
        </Press>
        <View>
          <ZText variant="captionStrong" style={styles.fieldLabel}>Base currency</ZText>
          <SegmentedControl options={COMMON_CURRENCIES.map((c) => ({ key: c, label: currencyLabel(c) }))} value={currency} onChange={setCurrency} />
          <ZText variant="small" color={color.textMuted} style={styles.helper}>Balances and settlement are in this currency. Expenses can be logged in any.</ZText>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      onBack={() => setStep(1)}
      hero={progress}
      title="Invite the crew"
      lead="Friends on Zebrasplit are added straight away. Everyone else gets one text with a link. You can add more people later."
      footer={
        <>
          {picks.length > 0 ? (
            <View style={styles.consent}>
              <Press onPress={() => setAgreed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} accessibilityLabel="I agree to the Terms and Conditions" scaleTo={0.98} style={styles.consentRow}>
                <CheckCircle on={agreed} />
                <ZText variant="body" style={styles.flex}>I agree to the <ZText variant="bodyStrong" style={styles.inlineLink} onPress={() => openBrowserAsync(TERMS)} accessibilityRole="link">Terms &amp; Conditions</ZText></ZText>
              </Press>
              <TextLink label="How Zebrasplit texts work" muted onPress={() => openBrowserAsync(SMS_INFO)} style={styles.smsLink} />
            </View>
          ) : null}
          <FormError>{error}</FormError>
          <Button label="Start the Dazzle" onPress={finish} loading={busy} disabled={picks.length > 0 && !agreed} />
        </>
      }
    >
      {picks.length > 0 ? (
        <View style={styles.chips} accessibilityLabel={`${picks.length} selected`}>
          {picks.map((p) => <Chip key={p.phone} label={p.name} onRemove={() => toggle(p)} />)}
        </View>
      ) : null}
      <Input
        left={<Icon name="search" size={18} color={color.textMuted} />}
        placeholder="Search people or type a number"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel="Search friends and contacts, or type a phone number"
      />
      {contacts === null ? (
        <Button kind="secondary" height={40} label="Add from your contacts" icon="person" onPress={loadContacts} style={styles.contactsButton} />
      ) : (
        // the contacts list has a way back out: hide it and the picks stay (feedback round 1, item 6)
        <View style={styles.contactsHead}>
          <ZText variant="captionStrong" color={color.textMuted} style={styles.flex}>{peopleLoading ? "Reading your contacts…" : `${contacts.length} contacts · only numbers you pick are sent`}</ZText>
          <TextLink label="Hide contacts" muted onPress={() => { setContacts(null); setPeopleError(null); }} />
        </View>
      )}
      {peopleError ? <ZText variant="small" color={color.error} style={styles.note}>{peopleError}</ZText> : null}
      <View style={styles.rows}>
        {typedRow ? (
          <PersonRow name={formatPhoneDisplay(typedRow)} caption="Invite by text" on={picked(typedRow)} onPress={() => toggle({ phone: typedRow, name: formatPhoneDisplay(typedRow) })} />
        ) : null}
        {shown.slice(0, MAX_ROWS).map((p) => (
          <PersonRow key={p.id} name={p.name} caption={p.subtitle ?? (p.phone ? formatPhoneDisplay(p.phone) : undefined)} photo={p.photo} on={picked(p.phone!)} onPress={() => toggle({ phone: p.phone!, name: p.name })} />
        ))}
        {peopleLoading ? <ActivityIndicator color={color.text} style={styles.spinner} /> : null}
        {!peopleLoading && !typedRow && shown.length === 0 ? (
          <ZText variant="body" color={color.textMuted} style={styles.note}>
            {q ? "No one matches that. Type a full number to invite it." : "No friends yet. People you've shared a Dazzle with show up here, or add from your contacts."}
          </ZText>
        ) : null}
        {shown.length > MAX_ROWS ? <ZText variant="small" color={color.textMuted} style={styles.note}>Showing the first {MAX_ROWS}. Search to narrow it down.</ZText> : null}
      </View>
    </AuthScreen>
  );
}

/** One person: RowCard with their avatar in the tile, name, caption and a round ink check on the right. */
function PersonRow({ name, caption, photo, on, onPress }: { name: string; caption?: string; photo?: string | null; on: boolean; onPress: () => void }) {
  return (
    <RowCard
      tile={<Avatar name={name} uri={photo} size={42} />}
      title={name}
      caption={caption}
      right={<CheckCircle on={on} />}
      onPress={onPress}
      accessibilityLabel={`${name}${caption ? `, ${caption}` : ""}, ${on ? "selected" : "not selected"}`}
    />
  );
}

/** Rounded ink check circle: ink fill with a white check when on, hairline ring when off. */
function CheckCircle({ on }: { on: boolean }) {
  return (
    <View style={[styles.check, on ? styles.checkOn : null]}>
      {on ? <Icon name="check" size={14} color={color.textOnInk} stroke={2.6} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progress: { alignSelf: "flex-start", paddingHorizontal: layout.textGutter - layout.screenGutter, paddingTop: 0 },
  dates: { flexDirection: "row", gap: space[10] },
  coverRow: { flexDirection: "row", alignItems: "center", gap: space[12], paddingHorizontal: space[4] },
  coverTile: { width: 64, height: 64, borderRadius: radius.tile, backgroundColor: color.surfaceTile, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fieldLabel: { marginBottom: 6, marginLeft: 4 },
  helper: { marginTop: 6, marginLeft: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  contactsButton: { alignSelf: "flex-start" },
  contactsHead: { flexDirection: "row", alignItems: "center", gap: space[8], paddingHorizontal: space[4] },
  rows: { gap: space[8] },
  note: { paddingHorizontal: space[4], paddingVertical: space[8] },
  spinner: { paddingVertical: space[16] },
  consent: { gap: space[4] },
  consentRow: { flexDirection: "row", alignItems: "center", gap: space[12], minHeight: layout.minTapTarget, paddingHorizontal: space[4] },
  inlineLink: { textDecorationLine: "underline" },
  smsLink: { alignSelf: "flex-start", marginLeft: 26 + space[12] + space[4] },
  check: { width: 26, height: 26, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.outline, backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: palette.ink, borderColor: palette.ink },
});
