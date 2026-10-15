import type { Metadata } from "next";
import { headers } from "next/headers";
import { Zebra } from "@/components/zebra";
import { Button } from "@/components/ui/Button";
import { StoreBadges } from "@/components/site/StoreBadges";
import { Wordmark } from "@/components/site/Wordmark";
import { JoinButtons } from "./JoinButtons";
import { formatDates, getInvitePreview, platformFromUA } from "@/lib/invite";
import { appStoreId, appStoreUrl, playStoreUrl, siteUrl, webAppUrl } from "@/lib/env";
import { site } from "@/content/site";
import s from "./join.module.css";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const inv = await getInvitePreview(code);
  const url = `${siteUrl}/join/${encodeURIComponent(code)}`;
  const title = inv.state === "invalid" ? "This invite link isn't working" : `${inv.inviter ?? "A friend"} invited you to ${inv.trip?.name ?? "a dazzle"} on Zebrasplit`;
  return {
    title: { absolute: title },
    description: site.joinDescription,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { title, description: site.joinDescription, url, type: "website", siteName: site.name },
    twitter: { card: "summary_large_image", title, description: site.joinDescription },
    ...(appStoreId ? { itunes: { appId: appStoreId, appArgument: url } } : {}),
  };
}

export default async function JoinPage({ params }: Params) {
  const { code } = await params;
  const [inv, h] = await Promise.all([getInvitePreview(code), headers()]);
  const platform = platformFromUA(h.get("user-agent"));
  const urls = { appStore: appStoreUrl, playStore: playStoreUrl };
  const browserHref = `${webAppUrl}/i/${encodeURIComponent(code)}`;
  const storeHref = platform === "ios" ? urls.appStore : platform === "android" ? urls.playStore : null;

  return (
    <main id="main" className={s.page}>
      <div className={s.card}>
        <div className={s.brand}><Wordmark size="join" /></div>

        {inv.state === "valid" && inv.trip ? (
          <>
            <div className={s.head}>
              <Zebra variant="bust" mood="wink" size={128} animate={{ blink: true }} decorative />
              <div className={s.invitedBy}>{inv.inviter ?? "A friend"} invited you to</div>
              <h1 className={s.title}>{inv.trip.name}</h1>
              <div className={s.meta}>{[formatDates(inv.trip.startDate, inv.trip.endDate), `${inv.memberCount} ${inv.memberCount === 1 ? "person" : "people"}`, `${inv.expenseCount} ${inv.expenseCount === 1 ? "expense" : "expenses"} so far`].filter(Boolean).join(" · ")}</div>
            </div>
            <section className={s.who} aria-labelledby="who-title">
              <div className={s.whoHead}><h2 id="who-title" className={s.whoTitle}>Who&apos;s in</h2><span className={s.whoCount}>{inv.doneCount} of {inv.memberCount} done</span></div>
              <ul className={s.avatars}>
                {inv.members.map((m, i) => (
                  <li key={`${m.name}-${i}`} className={s.person}>
                    <span className={[s.avatar, m.done ? s.avatarDone : s.avatarTodo].join(" ")} aria-hidden="true">{m.name.charAt(0).toUpperCase()}</span>
                    <span className={s.personName}>{m.name}<span className="srOnly">{m.done ? ", done" : ", still adding"}</span></span>
                  </li>
                ))}
                <li className={s.person}>
                  <span className={`${s.avatar} ${s.avatarYou}`} aria-hidden="true">You</span>
                  <span className={s.personInvited}>Invited</span>
                </li>
              </ul>
            </section>
            <div className={s.spacer} />
            <JoinButtons storeHref={storeHref} browserHref={browserHref} platform={platform} urls={urls} />
            <p className={s.small}>Already have Zebrasplit? This link opens it automatically.<br />Zebrasplit never holds your money. Venmo moves it.</p>
          </>
        ) : inv.state === "settled" && inv.trip ? (
          <>
            <div className={s.head}>
              <Zebra variant="bust" mood="sleepy" size={128} decorative />
              <h1 className={s.title}>This dazzle is all settled.</h1>
              <div className={s.meta}>{inv.trip.name} · everyone&apos;s paid up.</div>
            </div>
            <div className={s.spacer} />
            <div className={s.actions}>
              <StoreBadges urls={urls} location="join_settled" only={platform === "other" ? undefined : platform} />
              <Button variant="secondary" size="lg" full href={browserHref}>Continue in browser</Button>
            </div>
          </>
        ) : (
          <>
            <div className={s.head}>
              <Zebra variant="bust" mood="worried" size={128} decorative />
              <h1 className={s.title}>This invite link isn&apos;t working</h1>
              <div className={s.meta}>{inv.state === "expired" ? "It may have expired." : "It may be mistyped or expired."} Ask whoever organized the trip for a new link.</div>
            </div>
            <div className={s.spacer} />
            <div className={s.actions}>
              <StoreBadges urls={urls} location="join_invalid" only={platform === "other" ? undefined : platform} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
