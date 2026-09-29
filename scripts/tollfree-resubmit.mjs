// Resubmit the Twilio toll-free verification for +1 833 612 7553 after the
// 2026-09-29 rejection (30482 official-domain email, 30513 consent).
//
// Usage (run from the repo root once brad@check-m8.io exists and can receive mail):
//   TWILIO_ACCOUNT_SID=AC… TWILIO_AUTH_TOKEN=… BUSINESS_EMAIL=brad@check-m8.io node scripts/tollfree-resubmit.mjs
//
// It first tries to UPDATE the rejected request (HH8ad9…); if Twilio refuses
// (e.g. status no longer editable), it creates a new verification with the
// same fields and says which path it took. Never commit credentials.
const SID = process.env.TWILIO_ACCOUNT_SID, TOK = process.env.TWILIO_AUTH_TOKEN, EMAIL = process.env.BUSINESS_EMAIL;
if (!SID || !TOK || !EMAIL) { console.error("Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and BUSINESS_EMAIL"); process.exit(1); }
if (!/@check-m8\.io$/i.test(EMAIL)) { console.error(`BUSINESS_EMAIL must be on the official domain (got ${EMAIL}); Twilio rejects free-mail addresses (30482).`); process.exit(1); }

const REJECTED_SID = "HH8ad9189e807aae6d9ba06862e335e417";
const OPT_IN_IMAGE = "https://qywowvkkkxldgxoatdsh.supabase.co/storage/v1/object/public/site-assets/compliance/invite-opt-in-v2.png";
const SMS_PAGE = "https://www.check-m8.io/sms";
const SAMPLE = "Checkm8: Bradley added you to 'Tahoe long weekend' to split trip expenses. Open it: https://www.check-m8.io/i/3f9a1c2e Reply STOP to opt out.";
const CONSENT = "I have these people's permission to send them one text from Checkm8 about this trip. They can reply STOP to opt out. Msg & data rates may apply.";

const auth = "Basic " + Buffer.from(`${SID}:${TOK}`).toString("base64");
async function twilio(method, path, form) {
  const r = await fetch(`https://messaging.twilio.com/v1${path}`, { method, headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: form ? new URLSearchParams(form) : undefined });
  return [r.status, await r.json().catch(() => ({}))];
}

const [, nums] = await (async () => { const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=%2B18336127553`, { headers: { Authorization: auth } }); return [r.status, await r.json()]; })();
const pn = nums.incoming_phone_numbers?.[0];
if (!pn) { console.error("Toll-free number +1 833 612 7553 not found on this account"); process.exit(1); }

const fields = {
  BusinessType: "SOLE_PROPRIETOR",
  BusinessName: "Checkm8 (Bradley Russell, sole proprietor)",
  BusinessWebsite: "https://www.check-m8.io",
  NotificationEmail: EMAIL,
  BusinessContactEmail: EMAIL,
  BusinessContactFirstName: "Bradley",
  BusinessContactLastName: "Russell",
  BusinessContactPhone: "+16124236230",
  BusinessStreetAddress: "1801 Broadway Apt 402",
  BusinessCity: "San Francisco",
  BusinessStateProvinceRegion: "CA",
  BusinessPostalCode: "94109",
  BusinessCountry: "US",
  UseCaseCategories: "ACCOUNT_NOTIFICATIONS",
  MessageVolume: "1,000",
  OptInType: "WEB_FORM",
  OptInImageUrls: `${OPT_IN_IMAGE},${SMS_PAGE}`,
  ProductionMessageSample: SAMPLE,
  TollfreePhoneNumberSid: pn.sid,
  UseCaseSummary:
    "Checkm8 is a trip expense-splitting app. When a user adds friends to a trip by phone number, each friend gets one transactional invitation text with a link to the trip, sent only after the inviter ticks a required consent checkbox (see opt-in image and " + SMS_PAGE + "). No recurring or marketing messages; max 50 invites per user per day. STOP/HELP handled by the Messaging Service; every text ends with Reply STOP to opt out. Login codes go through Twilio Verify, not this number.",
  AdditionalInformation:
    "Consent flow: (1) a signed-in Checkm8 user opens 'Grab the Check' -> step 2 'Invite the group' and picks friends from contacts or types numbers; " +
    "(2) a required checkbox appears: \"" + CONSENT + "\" with a link 'How Checkm8 texts work' to " + SMS_PAGE + "; " +
    "(3) the Create button is disabled until the box is checked; (4) one invitation text per person is sent from the Messaging Service with STOP instructions. " +
    "Program disclosure (sender, frequency, opt-out, rates, sample message): " + SMS_PAGE + ". Privacy policy with the SMS section: https://www.check-m8.io/privacy. " +
    "Contact: " + EMAIL + ".",
};

let [st, body] = await twilio("POST", `/Tollfree/Verifications/${REJECTED_SID}`, fields);
let how = "updated the rejected request";
if (st >= 400) {
  console.log(`update refused (${st}: ${body.message ?? ""}); creating a new verification instead`);
  [st, body] = await twilio("POST", "/Tollfree/Verifications", fields);
  how = "created a new verification";
}
if (st >= 400) { console.error(`failed (${st})`, body.message ?? body, body.rejection_reason ?? ""); process.exit(1); }
console.log(`${how}: ${body.sid} -> ${body.status}`);
