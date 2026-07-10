# Runbook: Fire TV Stick Kiosk Install

Per PRD §3.3 ("Display Runtime"): the venue is wifi-only and the recommended
hardware is a **Fire TV Stick 4K** running a kiosk browser, positioned for
the best wifi signal available. This runbook is the one-time physical setup
for each TV, plus what to expect when things go wrong (wifi drops, power
loss, nightly reload) — those resilience behaviors are implemented in the
app itself (`src/app/display/**`); this doc is about the device around it.

No custom app or hardware is required — any device with a modern browser
that can be locked into kiosk mode works (Fire TV Stick, Chromecast with
Google TV, a smart TV's built-in browser, a spare laptop). This runbook
covers the Fire TV Stick path specifically since it's the recommended
option.

## What you're installing

The TV just needs a browser, locked into kiosk mode, pointed at:

```
https://<your-venue-domain>/display
```

(or `http://localhost:3000/display` during local dev/testing). Everything
else — pairing, rendering, polling, offline handling, nightly reload — is
handled by the web app already running at that URL. There is nothing to
install on a server; this is entirely "point a browser at a URL and lock it
there."

## Recommended: Fully Kiosk Browser

Silk (the Fire TV Stick's built-in browser) can load the page, but it has no
kiosk lockdown, no auto-launch-on-boot, and no crash auto-restart — a guest
(or a stray remote click) can navigate away from it, and a crash leaves a
blank screen until someone notices. **Fully Kiosk Browser** (free tier is
sufficient) solves all of that and is the app the PRD names explicitly.

### 1. Enable sideloading on the Fire TV Stick

1. **Settings → My Fire TV → About** → click the Fire TV Stick / device name
   entry **7 times** to unlock Developer Options.
2. **Settings → My Fire TV → Developer Options**:
   - Turn on **ADB debugging**.
   - Turn on **Apps from Unknown Sources**.
3. Rename the device (**Settings → My Fire TV → About → Change device name**)
   to something identifiable if you'll manage several TVs, e.g. "RPM — Bar
   TV", "RPM — Patio TV" — makes it easy to match to the right entry in
   **Settings → Displays** later.

### 2. Install Fully Kiosk Browser

Fully Kiosk Browser is on the Amazon Appstore — search for **"Fully Kiosk
Browser"** directly from the Fire TV Stick's built-in Appstore app and
install it like any other app. (If your Fire TV Stick's Appstore doesn't
list it in your region, sideload the APK via the **Downloader** app —
Fully Kiosk's own site publishes the direct APK link — then enable install
from the Downloader's source when prompted.)

### 3. Configure Fully Kiosk Browser

Open Fully Kiosk Browser once, then go into its settings (triple-tap the
screen, or **Settings → Fully Kiosk Browser Settings** from within the app)
and set:

- **Web Content Settings → Start URL**: `https://<your-venue-domain>/display`
- **Motion Detection**: off (not relevant to a wall-mounted TV, saves a
  background permission prompt).
- **Device Management → Start on Boot**: on — this is what makes power-loss
  recovery automatic (see below).
- **Device Management → Keep Screen On**: on.
- **Web Content Settings → Enable Fully's own reload timer**: leave **off**,
  or set it to something far apart from the app's own reload (see the
  "Nightly reload" section below) — the app already reloads itself nightly;
  a second, independent reload timer on top of that just adds a second
  random flash per day for no benefit and risks reloading mid-pairing.
- **Web Content Settings → Clear Cache/Cookies on start**: **must stay
  off.** The display's pairing token lives in the browser's `localStorage`
  (`src/app/display/storage.ts`) — if Fully Kiosk wipes storage on every
  launch, the TV re-requests pairing on every single boot instead of
  resuming automatically. This is the single most common kiosk-app
  misconfiguration that breaks power-loss recovery; double-check it.
- **Kiosk Mode**: enable "Lock Kiosk Mode" so the home/back buttons on the
  remote can't back out of the browser.

Exit settings; Fully Kiosk should now load `/display` full-screen.

## Pairing a new display

1. With the TV pointed at `/display`, it shows a large **6-character
   pairing code** (the alphabet deliberately excludes visually-ambiguous
   characters — no `0`/`O`, `1`/`I`/`L` — so it's easy to read and type
   correctly from across the room).
2. In the admin dashboard (any device — phone, laptop, tablet), log in as an
   owner and go to **Settings → Displays → Pair new display**.
3. Enter the code exactly as shown, give the display a name (e.g. "Bar TV"),
   and assign it to a screen.
4. **The code expires 10 minutes after the TV requests it.** If it expires
   before you finish pairing, no action is needed on the TV side — it
   automatically requests a fresh code every few seconds once the old one
   goes stale (`src/app/display/page.tsx`'s poll loop treats `expired` /
   `not_found` as "get a new code and keep waiting"). Just wait for the new
   code to appear and re-enter it in the admin UI.
5. Once paired, the TV receives a long-lived, revocable display token and
   immediately starts rendering the assigned screen — no reload or manual
   step needed on the TV.

## Reassigning a display

An owner can point an already-paired TV at a different screen at any time
from **Settings → Displays**, remotely, with zero action required on the TV
itself — it picks up the new screen on its next poll (every ~20 seconds).

## Nightly reload (4am)

The render page (`src/app/display/render/page.tsx`) schedules a full
`window.location.reload()` at the next 4am **by the device's own local
clock** — this is a defensive measure against memory leaks accumulating in
cheap TV browsers over a full day of continuous rendering, not something
the server triggers.

**This means the Fire TV Stick's system clock and timezone must be set
correctly** (they should be, out of the box, via the same wifi network) —
if the device's clock drifts or is set to the wrong timezone, the reload
will fire at the wrong wall-clock hour relative to the venue. Check
**Settings → Preferences → Date & Time** if a screen ever reloads at a
surprising moment.

Because reload is browser-native, the pairing token in `localStorage`
survives it untouched — the TV resumes rendering the same screen
immediately after the reload with no re-pairing.

## Wifi-drop behavior

This is a hard requirement (PRD §3.3), not best-effort:

- **Content freezes on last-known-good, it does not blank.** The TV keeps
  showing whatever it last successfully rendered — no flicker to a blank
  or error screen mid-service.
- **Retries with exponential backoff**, starting at the normal ~20s poll
  interval and backing off up to a 2-minute ceiling while the connection
  stays down, so a flaky wifi network doesn't hammer the server with
  retries.
- **A small, subtle offline dot** appears bottom-left of the screen after
  two consecutive failed polls (not on the very first blip, to avoid
  flicker from one dropped packet) — sized and positioned to be visible to
  staff walking up close to check on it, and invisible to a customer looking
  at the TV from across the bar.
- The moment the network recovers, the next successful poll clears the
  offline dot and resumes normal updates — no manual recovery step.

## Power-loss recovery

1. Power comes back → Fire TV Stick boots → Fully Kiosk Browser auto-launches
   (per "Start on Boot" above) → loads `/display`.
2. `/display`'s own logic checks `localStorage` for an existing pairing
   token first, *before* requesting a new pairing code — if one is found
   (and Fully Kiosk's cache-clearing setting was left off, see above), it
   skips straight to `/display/render` and resumes normal polling.
3. **No human involvement required** — this is the whole point of storing
   the token client-side rather than requiring re-pairing on every restart.

If a TV instead shows a fresh pairing code after a power cycle, the most
likely cause is Fully Kiosk's "clear cache/cookies on start" setting being
on — turn it off (see above).

## Revoking / decommissioning a display

Revoking a display's token from **Settings → Displays** takes effect on that
TV's *next poll* (~20s later): the poll endpoint starts returning 401, the
render page clears its stored token and redirects back to `/display`, which
immediately shows a fresh pairing code. No physical access to the TV is
needed to decommission it — useful for a stolen/lost device.

## Troubleshooting checklist

- **TV stuck on a pairing code that keeps changing every 10 minutes**: the
  admin side hasn't claimed it yet — double check you're on **Settings →
  Displays → Pair new display** and entering the *currently displayed* code
  (an old, already-expired code won't work even if you catch it just before
  the screen refreshes).
- **TV shows "Paired — waiting for a screen to be assigned"**: the display
  claimed successfully but no screen is assigned yet — assign one from
  **Settings → Displays**.
- **TV re-pairs after every reboot**: Fully Kiosk's cache/cookie-clearing
  setting is on; turn it off (see Configuration above).
- **TV reloads at the wrong time**: check the device's Date & Time settings.
- **Screen looks stale and the offline dot is showing**: that's the app
  behaving correctly under a wifi drop — check the venue's router/AP, not
  the TV itself.
- **Silk-only fallback**: if you genuinely cannot install Fully Kiosk (IT
  policy, region restriction, etc.), Silk can load `/display` and you can
  pin it to the home screen, but you lose kiosk lockdown, auto-launch on
  boot, and crash auto-restart — power-loss recovery and the "can't
  accidentally navigate away" guarantee both depend on those, so treat a
  Silk-only setup as a temporary measure, not the production configuration.
