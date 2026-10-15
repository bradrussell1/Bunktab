import { describe, expect, it } from "vitest";
import { countDone, memberState, stripeLayout } from "../src/zebra";
import { isValidNamePart, joinName, shortName, shortNameFromDisplay, splitName } from "../src/names";
import { nudgeBody, nudgeDedupeKey, nudgeable, utcDay } from "../src/nudge";

describe("stripes start empty and fill as members tap Done (item 9)", () => {
  const member = (done: boolean, removed = false) => ({ done_at: done ? "2026-10-15T00:00:00Z" : null, removed_at: removed ? "2026-10-01T00:00:00Z" : null });
  it("nobody done → zero ink stripes for every group size 2–12", () => {
    for (let n = 2; n <= 12; n++) {
      const { members, done } = countDone(Array.from({ length: n }, () => member(false)));
      expect(done).toBe(0);
      const s = stripeLayout(members, done);
      expect(s).toHaveLength(n);
      expect(s.some((x) => x.done)).toBe(false);
    }
  });
  it("Tahoe: 5 members, none done → 5 ghost stripes", () => {
    const { members, done } = countDone([member(false), member(false), member(false), member(false), member(false)]);
    expect(stripeLayout(members, done).map((x) => x.done)).toEqual([false, false, false, false, false]);
  });
  it("each Done fills one more stripe, left to right", () => {
    const rows = [member(true), member(false), member(true), member(false)];
    const { members, done } = countDone(rows);
    expect(done).toBe(2);
    expect(stripeLayout(members, done).map((x) => x.done)).toEqual([true, true, false, false]);
  });
  it("removed members are neither stripes nor done", () => {
    const { members, done } = countDone([member(true), member(true, true), member(false)]);
    expect(members).toBe(2);
    expect(done).toBe(1);
  });
  it("never more than 12 stripes drawn, whatever the group size", () => {
    for (const n of [12, 13, 20, 40]) expect(stripeLayout(n, 0)).toHaveLength(12);
    expect(stripeLayout(40, 0).some((x) => x.done)).toBe(false);
  });
  it("member pill states: quiet → adding → done", () => {
    expect(memberState({ done_at: null }, false)).toBe("quiet");
    expect(memberState({ done_at: null }, true)).toBe("adding");
    expect(memberState({ done_at: "2026-10-15T00:00:00Z" }, false)).toBe("done");
  });
});

describe("names (items 12, 18, 19)", () => {
  it("splits a display name into first and the rest", () => {
    expect(splitName("Mike Chen")).toEqual({ first: "Mike", last: "Chen" });
    expect(splitName("  Mary  Jane Watson ")).toEqual({ first: "Mary", last: "Jane Watson" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: null });
    expect(splitName("")).toEqual({ first: null, last: null });
    expect(splitName(null)).toEqual({ first: null, last: null });
  });
  it("joins parts back into the display name every reader uses", () => {
    expect(joinName("Mike", "Chen")).toBe("Mike Chen");
    expect(joinName(" Mike ", "")).toBe("Mike");
    expect(joinName(null, "Chen")).toBe("Chen");
    expect(joinName("", null)).toBeNull();
  });
  it('pill label is "First L."', () => {
    expect(shortName("Mike", "Chen")).toBe("Mike C.");
    expect(shortName("Jordan", "test")).toBe("Jordan T.");
    expect(shortName("Cher", null)).toBe("Cher");
    expect(shortName(null, null)).toBe("Member");
    expect(shortNameFromDisplay("Jen Alvarez")).toBe("Jen A.");
    expect(shortNameFromDisplay(null, "?")).toBe("?");
  });
  it("a name part needs a letter", () => {
    expect(isValidNamePart("Zoë")).toBe(true);
    expect(isValidNamePart(" ")).toBe(false);
    expect(isValidNamePart("123")).toBe(false);
  });
});

describe("nudge dedupe (item 13)", () => {
  const at = new Date("2026-10-15T23:30:00Z");
  it("one key per person per UTC day", () => {
    expect(utcDay(at)).toBe("2026-10-15");
    expect(nudgeDedupeKey("t1", "u1", at)).toBe("nudge:t1:u1:2026-10-15");
    expect(nudgeDedupeKey("t1", "u1", new Date("2026-10-16T00:10:00Z"))).toBe("nudge:t1:u1:2026-10-16");
    expect(nudgeDedupeKey("t1", "u2", at)).not.toBe(nudgeDedupeKey("t1", "u1", at));
  });
  it("lists who can still be nudged: not done, not removed, not me; flags today's sends", () => {
    const members = [
      { user_id: "me", done_at: null, removed_at: null },
      { user_id: "a", done_at: null, removed_at: null },
      { user_id: "b", done_at: "2026-10-15T00:00:00Z", removed_at: null },
      { user_id: "c", done_at: null, removed_at: "2026-10-01T00:00:00Z" },
      { user_id: "d", done_at: null, removed_at: null },
    ];
    const out = nudgeable(members, "t1", [nudgeDedupeKey("t1", "d", at)], "me", at);
    expect(out.map((x) => [x.member.user_id, x.sentToday])).toEqual([["a", false], ["d", true]]);
  });
  it("copy", () => {
    expect(nudgeBody("Tahoe weekend")).toBe("psst, add your receipts to Tahoe weekend");
  });
});
