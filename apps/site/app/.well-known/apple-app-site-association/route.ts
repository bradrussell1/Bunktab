import { deepLink } from "@/lib/env";

/** Universal Links: served as application/json, no extension, no redirect. 404 until TEAM_ID + BUNDLE_ID are set. */
export const dynamic = "force-static";

export function GET() {
  const { teamId, bundleId } = deepLink;
  if (!teamId || !bundleId) {
    console.warn("[well-known] apple-app-site-association: TEAM_ID / BUNDLE_ID unset → 404");
    return new Response("Not found", { status: 404 });
  }
  const appID = `${teamId}.${bundleId}`;
  const body = {
    applinks: { apps: [], details: [{ appIDs: [appID], components: [{ "/": "/join/*", comment: "Invite links" }] }] },
    webcredentials: { apps: [appID] },
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
