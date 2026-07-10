// Pure, DB-free weekly-schedule evaluation (PRD §3.2a): "Evaluated
// server-side against venue-local timezone (venue setting) at poll time —
// the display just asks 'what's my current screen + version,' so schedule
// changes propagate like any other change and no clock logic lives on the
// TV." Kept side-effect-free so it's independently unit-testable without a
// DB — src/lib/service/displays.ts wires this up to real `display_schedules`
// rows + `venue_settings.timezone`.
export interface ScheduleRule {
  id: string;
  /** 0 = Sunday .. 6 = Saturday, per src/db/schema/displays.ts's convention. */
  days: number[];
  /** "HH:MM" or "HH:MM:SS", 24-hour, venue-local wall clock. */
  startTime: string;
  /** "HH:MM" or "HH:MM:SS", 24-hour, venue-local wall clock. Exclusive. */
  endTime: string;
  screenId: string;
  /** Higher wins when multiple rules match the same instant. */
  priority: number;
}

export interface EvaluateScheduleInput {
  rules: ScheduleRule[];
  /** `displays.screen_id` — shown when no rule matches "the default screen
   * when no rule matches" (§3.2a). */
  defaultScreenId: string | null;
  now: Date;
  /** IANA timezone identifier, e.g. "America/Chicago". */
  timezone: string;
}

export interface EvaluatedSchedule {
  screenId: string | null;
  /** The rule that decided `screenId`, or null when the default applied. */
  matchedRuleId: string | null;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface WallClock {
  /** 0 = Sunday .. 6 = Saturday. */
  day: number;
  /** Minutes since local midnight, 0-1439. */
  minutes: number;
}

/** Resolves `now` to its venue-local weekday + minute-of-day via `Intl`, so
 * no manual UTC-offset/DST arithmetic lives here — `Intl.DateTimeFormat`
 * already knows every zone's DST rules. */
export function localWallClock(now: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const day = WEEKDAY_INDEX[map.weekday] ?? 0;
  // Some locales render midnight as "24" under hour12:false — normalize.
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute, 10);
  return { day, minutes: hour * 60 + minute };
}

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":");
  return parseInt(h, 10) * 60 + parseInt(m ?? "0", 10);
}

/**
 * Whether `wall` (day + minutes) falls inside one rule's window. Supports
 * windows that wrap past midnight (`startTime > endTime`, e.g. a late-night
 * screen 22:00-02:00): the "before midnight" half matches on the rule's own
 * listed day; the "after midnight" half matches on the *following* day
 * (i.e. `wall.day - 1` relative to the rule's day), since a 1am Tuesday
 * instant belongs to a rule whose `days` lists Monday.
 */
function ruleMatches(rule: ScheduleRule, wall: WallClock): boolean {
  const start = timeStringToMinutes(rule.startTime);
  const end = timeStringToMinutes(rule.endTime);
  if (start === end) return false; // zero-length window never matches.

  if (start < end) {
    return rule.days.includes(wall.day) && wall.minutes >= start && wall.minutes < end;
  }

  // Wraps past midnight.
  const previousDay = (wall.day + 6) % 7;
  const beforeMidnight = rule.days.includes(wall.day) && wall.minutes >= start;
  const afterMidnight = rule.days.includes(previousDay) && wall.minutes < end;
  return beforeMidnight || afterMidnight;
}

/**
 * Resolves the screen a display should currently show: the highest-priority
 * rule whose `(days, startTime, endTime)` window contains the venue-local
 * instant `now`, or `defaultScreenId` if none match. Ties on priority break
 * by rule id (stable, deterministic, arbitrary beyond that — `
 * display_schedules` carries no `created_at` to break ties on; admins who
 * care about overlap order should assign distinct priorities).
 */
export function evaluateSchedule(input: EvaluateScheduleInput): EvaluatedSchedule {
  const wall = localWallClock(input.now, input.timezone);
  const matches = input.rules.filter((rule) => ruleMatches(rule, wall));

  if (matches.length === 0) {
    return { screenId: input.defaultScreenId, matchedRuleId: null };
  }

  matches.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const winner = matches[0];
  return { screenId: winner.screenId, matchedRuleId: winner.id };
}
