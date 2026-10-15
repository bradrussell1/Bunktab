import { deepLink } from "@/lib/env";

/** Android App Links. 404 until ANDROID_PACKAGE + ANDROID_SHA256_FINGERPRINTS are set. */
export const dynamic = "force-static";

export function GET() {
  const { androidPackage, androidFingerprints } = deepLink;
  if (!androidPackage || androidFingerprints.length === 0) {
    console.warn("[well-known] assetlinks.json: ANDROID_PACKAGE / ANDROID_SHA256_FINGERPRINTS unset → 404");
    return new Response("Not found", { status: 404 });
  }
  const body = [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: androidPackage, sha256_cert_fingerprints: androidFingerprints } }];
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
