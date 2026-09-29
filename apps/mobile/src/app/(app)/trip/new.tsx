import { COMMON_CURRENCIES } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import * as Contacts from "expo-contacts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { DateField } from "@/components/DatePicker";
import { Button, Card, Input, ListItem, Screen, Text } from "@/components/ui";
import { toE164, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Create trip, two steps (spec: Screens → Create trip). 1 · Details: title,
 * description (250, with counter), start and end dates, base currency.
 * 2 · Invite: pick from the phone's contacts or type a number. Contacts
 * are read on the device only; only the numbers picked are sent (spec:
 * Security → Contacts). Invitees get a text with a link once the invite
 * function ships (phase 4); the rows are written now so phone login links
 * them the moment they sign in.
 */
type Pick = { phone: string; name: string };

export default function NewTripScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ step?: string; openDate?: string; jump?: string }>();
  // DEV only: `?step=2` opens the invite step directly (screenshots, tests)
  const [step, setStep] = useState<1 | 2>(__DEV__ && params.step === "2" ? 2 : 1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [manual, setManual] = useState("");
  const [contacts, setContacts] = useState<Pick[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  function next() {
    if (title.trim().length === 0) return setError("Give the trip a title.");
    if (!start || !end) return setError("Pick a start and an end date.");
    if (end < start) return setError("The end date can't be before the start.");
    setError(null); setStep(2);
  }

  async function loadContacts() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") { setError("Contacts permission was declined. You can still type a number."); return; }
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], pageSize: 2000 });
    const list: Pick[] = [];
    for (const c of data) for (const p of c.phoneNumbers ?? []) {
      const e = toE164(p.number ?? "");
      if (e && !list.some((x) => x.phone === e)) list.push({ phone: e, name: c.name ?? e });
    }
    setContacts(list.sort((a, b) => a.name.localeCompare(b.name)));
  }
  function toggle(p: Pick) { setPicks((ps) => (ps.some((x) => x.phone === p.phone) ? ps.filter((x) => x.phone !== p.phone) : [...ps, p])); }
  function addManual() {
    const e = toE164(manual);
    if (!e) return setError("That doesn't look like a phone number.");
    if (e === profile?.phone || `+${profile?.phone}` === e) return setError("That's you.");
    toggle({ phone: e, name: e }); setManual(""); setError(null);
  }

  async function finish() {
    setBusy(true); setError(null);
    const { data: trip, error: e1 } = await supabase.from("trips").insert({ title: title.trim(), description: description.trim() || null, start_date: start, end_date: end, base_currency: currency, created_by: session!.user.id }).select("id").single();
    if (e1 || !trip) { setBusy(false); setError(e1?.message ?? "Couldn't create the trip."); return; }
    if (picks.length) {
      const { error: e2 } = await supabase.from("invites").insert(picks.map((p) => ({ trip_id: trip.id, phone: p.phone.replace(/^\+/, ""), invited_by: session!.user.id })));
      if (e2) { setBusy(false); setError(`Trip created, but the invites failed: ${e2.message}`); router.replace(`/(app)/trip/${trip.id}`); return; }
    }
    setBusy(false);
    router.replace(`/(app)/trip/${trip.id}`);
  }

  const shownContacts = (contacts ?? []).filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query));

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: theme.spacing.sm }}>
          <Button title={step === 1 ? "Cancel" : "Back"} kind="text" size="small" onPress={() => (step === 1 ? router.back() : setStep(1))} />
          <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Step {step} of 2</Text>
        </View>
        <View style={{ height: 3, backgroundColor: theme.colors.fill.secondary, borderRadius: 2, marginBottom: theme.spacing.lg }}>
          <View style={{ width: step === 1 ? "50%" : "100%", height: 3, backgroundColor: theme.colors.fill.primary, borderRadius: 2 }} />
        </View>

        {step === 1 ? (
          <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <Text variant="largeTitle">New trip</Text>
            <Input label="Title" placeholder="Tahoe long weekend" value={title} onChangeText={setTitle} maxLength={80} autoFocus />
            <Input label="Description (optional)" placeholder="Who, where, what to remember" value={description} onChangeText={(v) => setDescription(v.slice(0, 250))} multiline numberOfLines={3} style={{ height: 88, paddingTop: 12 }} helper={`${description.length}/250`} />
            <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
              <View style={{ flex: 1 }}><DateField label="Start date" value={start} onChange={(d) => { setStart(d); if (end && end < d) setEnd(""); }} devOpen={__DEV__ && params.openDate === "start"} devJump={__DEV__ && params.jump === "1"} /></View>
              <View style={{ flex: 1 }}><DateField label="End date" value={end} onChange={setEnd} min={start || undefined} devOpen={__DEV__ && params.openDate === "end"} /></View>
            </View>
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Base currency</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {COMMON_CURRENCIES.slice(0, 8).map((c) => (
                  <Pressable key={c} onPress={() => setCurrency(c)} accessibilityRole="radio" accessibilityState={{ selected: currency === c }}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: currency === c ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: currency === c ? theme.colors.fill.primary : theme.colors.background.surface }}>
                    <Text variant="caption1Semibold" color={currency === c ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.primary}>{c}</Text>
                  </Pressable>
                ))}
              </View>
              <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Balances and settlement are in this currency. Expenses can be logged in any.</Text>
            </View>
            {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, gap: theme.spacing.md }}>
            <Text variant="largeTitle">Invite the group</Text>
            {picks.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {picks.map((p) => (
                  <Pressable key={p.phone} onPress={() => toggle(p)} accessibilityLabel={`Remove ${p.name}`} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.fill.secondary, flexDirection: "row", gap: 6 }}>
                    <Text variant="caption1Semibold">{p.name}</Text><Text variant="caption1Semibold" color={theme.colors.text.onBackground.tertiary}>×</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}><Input label="Add by number" placeholder="(555) 555-0101" keyboardType="phone-pad" value={manual} onChangeText={setManual} onSubmitEditing={addManual} /></View>
              <Button title="Add" kind="secondary" size="medium" onPress={addManual} style={{ marginBottom: 0 }} />
            </View>
            {contacts === null ? (
              <Button title="Pick from contacts" kind="secondary" size="medium" onPress={loadContacts} />
            ) : (
              <>
                <Input placeholder="Search contacts" value={query} onChangeText={setQuery} />
                <Card style={{ padding: 0, flex: 1, overflow: "hidden" }}>
                  <FlatList data={shownContacts} keyExtractor={(c) => c.phone} keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const on = picks.some((x) => x.phone === item.phone);
                      return <ListItem title={item.name} subtitle={item.phone} onPress={() => toggle(item)} right={<View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on && <Text variant="caption3" color={theme.colors.text.onFill.onPrimary}>✓</Text>}</View>} />;
                    }}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.divider.default }} />}
                    ListEmptyComponent={<Text variant="caption1" color={theme.colors.text.onBackground.secondary} style={{ padding: 16 }}>No contacts with phone numbers match.</Text>} />
                </Card>
              </>
            )}
            {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          </View>
        )}

        <View style={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.sm }}>
          {step === 1
            ? <Button title="Next: invite people" onPress={next} />
            : <Button title={picks.length ? `Create trip and invite ${picks.length}` : "Create trip"} onPress={finish} loading={busy} />}
          {step === 2 && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>Each person gets one text from Checkm8 with a link to this trip and can reply STOP. Only add people who expect it. You can add more later.</Text>}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
