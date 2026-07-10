import { describe, expect, it } from "vitest";
import { evaluateSchedule, localWallClock, type ScheduleRule } from "./evaluate";

const TZ = "America/Chicago";

// 2026-07-09 is a Thursday. Times below are UTC instants chosen so their
// America/Chicago (UTC-5 in July, CDT) wall-clock times land on convenient
// round numbers for the assertions.
function chicagoInstant(hour: number, minute = 0): Date {
  // Chicago is UTC-5 during CDT (July) -> Chicago HH:MM == UTC (HH+5):MM.
  return new Date(Date.UTC(2026, 6, 9, hour + 5, minute));
}

describe("localWallClock", () => {
  it("resolves the venue-local weekday and minute-of-day", () => {
    const wall = localWallClock(chicagoInstant(14, 30), TZ);
    expect(wall.day).toBe(4); // Thursday
    expect(wall.minutes).toBe(14 * 60 + 30);
  });

  it("normalizes midnight correctly", () => {
    const wall = localWallClock(chicagoInstant(0, 0), TZ);
    expect(wall.minutes).toBe(0);
  });
});

describe("evaluateSchedule", () => {
  const happyHour: ScheduleRule = {
    id: "rule-happy-hour",
    days: [1, 2, 3, 4, 5], // Mon-Fri
    startTime: "16:00",
    endTime: "19:00",
    screenId: "screen-happy-hour",
    priority: 0,
  };

  const draftDefault = "screen-draft-list";

  it("falls back to the default screen when no rule matches", () => {
    const result = evaluateSchedule({
      rules: [happyHour],
      defaultScreenId: draftDefault,
      now: chicagoInstant(10, 0), // Thursday 10am — before the window
      timezone: TZ,
    });
    expect(result).toEqual({ screenId: draftDefault, matchedRuleId: null });
  });

  it("matches a rule whose window contains the current instant", () => {
    const result = evaluateSchedule({
      rules: [happyHour],
      defaultScreenId: draftDefault,
      now: chicagoInstant(17, 0), // Thursday 5pm — inside 4-7pm
      timezone: TZ,
    });
    expect(result).toEqual({ screenId: "screen-happy-hour", matchedRuleId: "rule-happy-hour" });
  });

  it("end time is exclusive", () => {
    const result = evaluateSchedule({
      rules: [happyHour],
      defaultScreenId: draftDefault,
      now: chicagoInstant(19, 0), // exactly 7pm
      timezone: TZ,
    });
    expect(result.screenId).toBe(draftDefault);
  });

  it("does not match on a day not listed", () => {
    // 2026-07-11 is a Saturday.
    const saturday = new Date(Date.UTC(2026, 6, 11, 17 + 5, 0));
    const result = evaluateSchedule({
      rules: [happyHour],
      defaultScreenId: draftDefault,
      now: saturday,
      timezone: TZ,
    });
    expect(result.screenId).toBe(draftDefault);
  });

  it("picks the highest-priority match when rules overlap", () => {
    const lowPriority: ScheduleRule = { ...happyHour, id: "rule-low", priority: 0, screenId: "screen-low" };
    const highPriority: ScheduleRule = { ...happyHour, id: "rule-high", priority: 5, screenId: "screen-high" };
    const result = evaluateSchedule({
      rules: [lowPriority, highPriority],
      defaultScreenId: draftDefault,
      now: chicagoInstant(17, 0),
      timezone: TZ,
    });
    expect(result.screenId).toBe("screen-high");
    expect(result.matchedRuleId).toBe("rule-high");
  });

  it("supports a window that wraps past midnight", () => {
    const lateNight: ScheduleRule = {
      id: "rule-late-night",
      days: [5], // Friday
      startTime: "22:00",
      endTime: "02:00",
      screenId: "screen-late-night",
      priority: 0,
    };
    // 2026-07-10 is a Friday. 23:00 Friday should match (before-midnight half).
    const fridayNight = new Date(Date.UTC(2026, 6, 10, 23 + 5, 0));
    const resultFridayNight = evaluateSchedule({
      rules: [lateNight],
      defaultScreenId: draftDefault,
      now: fridayNight,
      timezone: TZ,
    });
    expect(resultFridayNight.screenId).toBe("screen-late-night");

    // 2026-07-11 01:00 (Saturday) is still within the Friday-night window
    // (after-midnight half), because the rule's `days` lists Friday.
    const saturdayEarly = new Date(Date.UTC(2026, 6, 11, 1 + 5, 0));
    const resultSaturdayEarly = evaluateSchedule({
      rules: [lateNight],
      defaultScreenId: draftDefault,
      now: saturdayEarly,
      timezone: TZ,
    });
    expect(resultSaturdayEarly.screenId).toBe("screen-late-night");

    // 2026-07-11 03:00 (Saturday) is past the window.
    const saturdayLate = new Date(Date.UTC(2026, 6, 11, 3 + 5, 0));
    const resultSaturdayLate = evaluateSchedule({
      rules: [lateNight],
      defaultScreenId: draftDefault,
      now: saturdayLate,
      timezone: TZ,
    });
    expect(resultSaturdayLate.screenId).toBe(draftDefault);
  });

  it("returns null screenId when there is no default and nothing matches", () => {
    const result = evaluateSchedule({
      rules: [],
      defaultScreenId: null,
      now: chicagoInstant(10, 0),
      timezone: TZ,
    });
    expect(result).toEqual({ screenId: null, matchedRuleId: null });
  });
});
