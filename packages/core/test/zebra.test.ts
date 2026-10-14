import { describe, expect, it } from "vitest";
import { progressMood, stripeLayout, zebraLabel, zebraMoodFor, ZEBRA_STRIPE } from "../src/zebra";

describe("stripeLayout", () => {
  it("six members use the six fixed centres at width 13, filled left to right", () => {
    const s = stripeLayout(6, 3);
    expect(s.map((x) => x.cx)).toEqual([...ZEBRA_STRIPE.six]);
    expect(s.every((x) => x.width === 13)).toBe(true);
    expect(s.map((x) => x.done)).toEqual([true, true, true, false, false, false]);
  });
  it("4 members spread evenly from 152 to 265 (matches zebra-full-4-members-2-done.svg)", () => {
    const s = stripeLayout(4, 2);
    expect(s.map((x) => x.cx)).toEqual([152, 189.7, 227.3, 265]);
    expect(s[0].width).toBe(13);
    expect(s.map((x) => x.done)).toEqual([true, true, false, false]);
  });
  it("10 members narrow to 0.56 × spacing (matches zebra-full-10-members-7-done.svg)", () => {
    const s = stripeLayout(10, 7);
    expect(s[0].width).toBe(7.1);
    expect(s[1].cx).toBe(164.6);
    expect(s[9].cx).toBe(265);
    expect(s.filter((x) => x.done)).toHaveLength(7);
  });
  it("above 12 members draws 12 and fills proportionally, all 12 only when everyone is done", () => {
    expect(stripeLayout(20, 10)).toHaveLength(12);
    expect(stripeLayout(20, 10).filter((x) => x.done)).toHaveLength(6);
    expect(stripeLayout(20, 19).filter((x) => x.done)).toHaveLength(11);
    expect(stripeLayout(20, 20).filter((x) => x.done)).toHaveLength(12);
  });
  it("clamps done to members and handles 0 and 1", () => {
    expect(stripeLayout(6, 9).filter((x) => x.done)).toHaveLength(6);
    expect(stripeLayout(0, 0)).toEqual([]);
    expect(stripeLayout(1, 1)).toEqual([{ cx: 208.5, width: 13, done: true }]);
  });
});

describe("progressMood", () => {
  it("six members: 0–2 hi, 3–5 happy, 6 starry", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => progressMood(6, d))).toEqual(["hi", "hi", "hi", "happy", "happy", "happy", "starry"]);
  });
  it("odd groups: half rounds up to happy", () => {
    expect(progressMood(5, 2)).toBe("hi");
    expect(progressMood(5, 3)).toBe("happy");
    expect(progressMood(1, 0)).toBe("hi");
    expect(progressMood(1, 1)).toBe("starry");
  });
});

describe("zebraMoodFor (the §7 table)", () => {
  it("home hero: net > 0 happy, < 0 worried, 0 with nothing open sleepy, 0 with open dazzles hi", () => {
    expect(zebraMoodFor({ place: "home-hero", netCents: 1, openDazzles: 2 })).toBe("happy");
    expect(zebraMoodFor({ place: "home-hero", netCents: -1, openDazzles: 2 })).toBe("worried");
    expect(zebraMoodFor({ place: "home-hero", netCents: 0, openDazzles: 0 })).toBe("sleepy");
    expect(zebraMoodFor({ place: "home-hero", netCents: 0, openDazzles: 1 })).toBe("hi");
  });
  it("dazzle card: worried only when you owe, otherwise no zebra", () => {
    expect(zebraMoodFor({ place: "home-card", youOwe: true })).toBe("worried");
    expect(zebraMoodFor({ place: "home-card", youOwe: false })).toBeNull();
  });
  it("dazzle hero and stripes follow the progress rule", () => {
    expect(zebraMoodFor({ place: "dazzle-hero", members: 6, done: 3 })).toBe("happy");
    expect(zebraMoodFor({ place: "stripes", members: 6, done: 6 })).toBe("starry");
  });
  it("nights: sleepy when every cost is claimed, worried otherwise", () => {
    expect(zebraMoodFor({ place: "nights", unclaimedCents: 0 })).toBe("sleepy");
    expect(zebraMoodFor({ place: "nights", unclaimedCents: 1250 })).toBe("worried");
  });
  it("payment hi → love; nudge happy; recap starry; invite wink; login hi → happy; done pill happy; error worried", () => {
    expect(zebraMoodFor({ place: "payment", paid: false })).toBe("hi");
    expect(zebraMoodFor({ place: "payment", paid: true })).toBe("love");
    expect(zebraMoodFor({ place: "nudge" })).toBe("happy");
    expect(zebraMoodFor({ place: "recap" })).toBe("starry");
    expect(zebraMoodFor({ place: "invite" })).toBe("wink");
    expect(zebraMoodFor({ place: "login", profileSaved: false })).toBe("hi");
    expect(zebraMoodFor({ place: "login", profileSaved: true })).toBe("happy");
    expect(zebraMoodFor({ place: "person-pill-done" })).toBe("happy");
    expect(zebraMoodFor({ place: "error" })).toBe("worried");
  });
  it("empty states: no dazzles hi, no past sleepy, no results worried", () => {
    expect(zebraMoodFor({ place: "empty", kind: "no-dazzles" })).toBe("hi");
    expect(zebraMoodFor({ place: "empty", kind: "no-past" })).toBe("sleepy");
    expect(zebraMoodFor({ place: "empty", kind: "no-results" })).toBe("worried");
  });
  it("labels", () => {
    expect(zebraLabel("happy", 6, 3)).toBe("Zebra with 3 of 6 stripes, happy");
    expect(zebraLabel("wink")).toBe("Zebra, wink");
  });
});
