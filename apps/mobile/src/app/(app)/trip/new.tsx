import { COMMON_CURRENCIES, formatPhoneDisplay, formatUsPhoneInput, toE164 } from "@bunktab/core";
import { theme } from "@bunktab/theme";
import * as Contacts from "expo-contacts/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ContactSheet } from "@/components/ContactSheet";
import { DateField } from "@/components/DatePicker";
import { PhoneInput } from "@/components/PhoneInput";
import { Button, Input, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { fetchFriends, type Person } from "@/lib/friends";
import { currencyLabel } from "@/lib/currencyLabels";
import { supabase } from "@/lib/supabase";

/**
 * Create trip, two steps (spec: Screens → Create trip). 1 · Details: title,
 * description (250, with counter), start and end dates, base currency.
 * 2 · Invite: type a number (formatted as you go), "Invite your friends"
 * (people you've shared a Bunktab trip with) or "Select from contacts"
 * (read on the device only; only the numbers picked are sent). People who
 * already use Bunktab are added straight to the trip; everyone else gets one
 * text with a link. Both steps scroll with the keyboard so the button is
 * never hidden.
 */
type Pick = { phone: string; name: string };

const TERMS = "https://www.bunktab.com/terms";
const SMS_INFO = "https://www.bunktab.com/sms";

export default function NewTripScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const me = session!.user.id;
  const params = useLocalSearchParams<{ step?: string; openDate?: string; jump?: string; consent?: string; demo?: string; sheet?: string; typed?: string; scrollEnd?: string }>();
  // DEV only: `?step=2` opens the invite step directly (screenshots, tests)
  const [step, setStep] = useState<1 | 2>(__DEV__ && params.step === "2" ? 2 : 1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  // DEV only: `?demo=1` pre-fills one invitee and `?consent=1` ticks the box (compliance screenshots)
  const [picks, setPicks] = useState<Pick[]>(__DEV__ && params.demo === "1" ? [{ phone: "+15555550199", name: "(555) 555-0199" }] : []);
  const [agreed, setAgreed] = useState(__DEV__ && params.consent === "1");
  // DEV only: `?typed=5555550` seeds the number field (formatting screenshots); `?scrollEnd=1` scrolls to the button
  const [manual, setManual] = useState(__DEV__ && params.typed ? formatUsPhoneInput(params.typed) : "");
  const [manualE164, setManualE164] = useState<string | null>(__DEV__ && params.typed ? toE164(formatUsPhoneInput(params.typed)) : null);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { if (__DEV__ && params.scrollEnd === "1") setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 600); }, [params.scrollEnd]);
  const [busy, setBusy] = useState(false);

  // people picker
  const [sheet, setSheet] = useState<"friends" | "contacts" | null>(__DEV__ && (params.sheet === "friends" || params.sheet === "contacts") ? params.sheet : null);
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [contacts, setContacts] = useState<Person[] | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  function next() {
    if (title.trim().length === 0) return setError("Give the trip a title.");
    if (!start || !end) return setError("Pick a start and an end date.");
    if (end < start) return setError("The end date can't be before the start.");
    setError(null); setStep(2);
  }

  const loadFriends = useCallback(async () => {
    setSheetLoading(true); setSheetError(null);
    try { setFriends(await fetchFriends(me)); } catch (e) { setSheetError(e instanceof Error ? e.message : "Couldn't load your friends."); setFriends([]); }
    setSheetLoading(false);
  }, [me]);

  const loadContacts = useCallback(async () => {
    setSheetLoading(true); setSheetError(null);
    try {
      const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        setSheetError(canAskAgain ? "Contacts permission was declined. You can still type a number." : "Contacts access is off. Turn it on in Settings › Bunktab › Contacts, or type a number.");
        setContacts([]); setSheetLoading(false); return;
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
      setSheetError(e instanceof Error ? e.message : "Couldn't read your contacts.");
      setContacts([]);
    }
    setSheetLoading(false);
  }, []);

  function openSheet(which: "friends" | "contacts") {
    setError(null); setSheet(which);
    if (which === "friends" && friends === null) loadFriends();
    if (which === "contacts" && contacts === null) loadContacts();
  }
  // DEV: `?sheet=friends|contacts` opens the picker on mount
  useEffect(() => { if (sheet === "friends" && friends === null) loadFriends(); if (sheet === "contacts" && contacts === null) loadContacts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function isMe(e164: string) { const mine = profile?.phone?.replace(/^\+/, ""); return !!mine && e164.replace(/^\+/, "") === mine; }
  function toggle(p: Pick) { setPicks((ps) => (ps.some((x) => x.phone === p.phone) ? ps.filter((x) => x.phone !== p.phone) : [...ps, p])); }
  function addManual() {
    if (!manualE164) return setError("That doesn't look like a phone number.");
    if (isMe(manualE164)) return setError("That's you.");
    const e = manualE164;
    if (!picks.some((x) => x.phone === e)) setPicks((ps) => [...ps, { phone: e, name: formatPhoneDisplay(e) }]);
    setManual(""); setManualE164(null); setError(null);
  }
  function addPeople(people: Person[]) {
    const source = sheet === "friends" ? friends ?? [] : contacts ?? [];
    const additions: Pick[] = people.filter((p) => p.phone && !isMe(p.phone)).map((p) => ({ phone: p.phone!, name: p.name }));
    setPicks((ps) => {
      // people from this source who were unticked drop out; everyone else stays
      const kept = ps.filter((x) => additions.some((a) => a.phone === x.phone) || !source.some((p) => p.phone === x.phone));
      const merged = [...kept];
      for (const a of additions) if (!merged.some((x) => x.phone === a.phone)) merged.push(a);
      return merged;
    });
    setSheet(null);
  }

  async function finish() {
    if (picks.length > 0 && !agreed) return setError("Agree to the Terms & Conditions to send invites.");
    setBusy(true); setError(null);
    const { data: trip, error: e1 } = await supabase.from("trips").insert({ title: title.trim(), description: description.trim() || null, start_date: start, end_date: end, base_currency: currency, created_by: me }).select("id").single();
    if (e1 || !trip) { setBusy(false); setError(e1?.message ?? "Couldn't create the trip."); return; }
    if (picks.length) {
      const { error: e2 } = await supabase.from("invites").insert(picks.map((p) => ({ trip_id: trip.id, phone: p.phone.replace(/^\+/, ""), invited_by: me })));
      if (e2) { setBusy(false); setError(`Trip created, but the invites failed: ${e2.message}`); router.replace(`/(app)/trip/${trip.id}`); return; }
    }
    setBusy(false);
    router.replace(`/(app)/trip/${trip.id}`);
  }

  const sheetPeople = sheet === "friends" ? friends ?? [] : contacts ?? [];
  const sheetSelected = picks.map((p) => sheetPeople.find((x) => x.phone === p.phone)?.id).filter((x): x is string => !!x);

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: theme.spacing.sm }}>
        <Button title={step === 1 ? "Cancel" : "Back"} kind="text" size="small" onPress={() => (step === 1 ? router.back() : setStep(1))} />
        <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Step {step} of 2</Text>
      </View>
      <View style={{ height: 3, backgroundColor: theme.colors.fill.secondary, borderRadius: 2, marginBottom: theme.spacing.lg }}>
        <View style={{ width: step === 1 ? "50%" : "100%", height: 3, backgroundColor: theme.colors.fill.primary, borderRadius: 2 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        {step === 1 ? (
          <>
            <Text variant="largeTitle">Grab the Check</Text>
            <Input label="Title" placeholder="Tahoe long weekend" value={title} onChangeText={setTitle} maxLength={80} returnKeyType="next" />
            <Input label="Description (optional)" placeholder="Who, where, what to remember" value={description} onChangeText={(v) => setDescription(v.slice(0, 250))} multiline numberOfLines={3} style={{ height: 88, paddingTop: 12 }} helper={`${description.length}/250`} />
            <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}><DateField label="Start date" value={start} onChange={(d) => { setStart(d); if (end && end < d) setEnd(""); }} devOpen={__DEV__ && params.openDate === "start"} devJump={__DEV__ && params.jump === "1"} /></View>
              <View style={{ flex: 1 }}><DateField label="End date" value={end} onChange={setEnd} min={start || undefined} devOpen={__DEV__ && params.openDate === "end"} /></View>
            </View>
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Base currency</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {COMMON_CURRENCIES.map((c) => (
                  <Pressable key={c} onPress={() => setCurrency(c)} accessibilityRole="radio" accessibilityState={{ selected: currency === c }}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: currency === c ? theme.colors.fill.primary : theme.colors.border.neutral, backgroundColor: currency === c ? theme.colors.fill.primary : theme.colors.background.surface }}>
                    <Text variant="caption1Semibold" color={currency === c ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.primary}>{currencyLabel(c)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Balances and settlement are in this currency. Expenses can be logged in any.</Text>
            </View>
            {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
            <Button title="Next" onPress={next} style={{ marginTop: theme.spacing.sm }} />
          </>
        ) : (
          <>
            <Text variant="largeTitle">Invite the group</Text>
            {picks.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {picks.map((p) => (
                  <Pressable key={p.phone} onPress={() => toggle(p)} accessibilityLabel={`Remove ${p.name}`} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.fill.secondary, borderWidth: 1, borderColor: theme.colors.border.soft, flexDirection: "row", gap: 6 }}>
                    <Text variant="caption1Semibold">{p.name}</Text><Text variant="caption1Semibold" color={theme.colors.text.onBackground.tertiary}>×</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}><PhoneInput label="Add by number" value={manual} onChange={(d, e) => { setManual(d); setManualE164(e); }} onSubmit={addManual} /></View>
              <Button title="Add" kind="secondary" size="medium" onPress={addManual} disabled={!manualE164} />
            </View>
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <Button title="Invite your friends" kind="secondary" size="medium" style={{ flex: 1 }} onPress={() => openSheet("friends")} />
              <Button title="Select from contacts" kind="secondary" size="medium" style={{ flex: 1 }} onPress={() => openSheet("contacts")} />
            </View>
            {sheetError && !sheet && <Text variant="caption1" color={theme.colors.text.destructive}>{sheetError}</Text>}
            {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              {picks.length > 0 && (
                <View style={{ gap: theme.spacing.xs }}>
                  <Pressable onPress={() => setAgreed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: agreed ? theme.colors.fill.primary : theme.colors.border.neutral, backgroundColor: agreed ? theme.colors.fill.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{agreed && <Text variant="caption3" color={theme.colors.text.onFill.onPrimary}>✓</Text>}</View>
                    <Text variant="body" style={{ flex: 1 }}>I agree to the <Text variant="text" color={theme.colors.text.onBackground.accent} onPress={() => openBrowserAsync(TERMS)}>Terms &amp; Conditions</Text></Text>
                  </Pressable>
                  <Pressable onPress={() => openBrowserAsync(SMS_INFO)} accessibilityRole="link" style={{ paddingLeft: 34 }}>
                    <Text variant="caption1Semibold" color={theme.colors.text.onBackground.accent}>How Bunktab texts work ↗</Text>
                  </Pressable>
                </View>
              )}
              <Button title={picks.length ? `Create trip and invite ${picks.length}` : "Create trip"} onPress={finish} loading={busy} disabled={picks.length > 0 && !agreed} />
              <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>Friends already on Bunktab are added straight away. Everyone else gets one text with a link. You can add more people later.</Text>
            </View>
          </>
        )}
      </ScrollView>

      <ContactSheet
        visible={sheet !== null}
        title={sheet === "friends" ? "Invite your friends" : "Select from contacts"}
        people={sheetPeople}
        loading={sheetLoading}
        emptyText={sheetError ?? (sheet === "friends" ? "No friends yet. People you've shared a Bunktab trip with will show up here." : "No contacts with phone numbers.")}
        initialSelected={sheetSelected}
        onClose={() => setSheet(null)}
        onConfirm={addPeople}
      />
    </Screen>
  );
}
