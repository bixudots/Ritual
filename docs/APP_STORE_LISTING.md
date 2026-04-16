# App Store Listing — The Ritual

_Draft copy for App Store Connect. Tune after beta feedback._

## Basics

- **App name**: The Ritual
- **Subtitle** (30 chars max): `Habits, streaks & time capsules`  _(30)_
- **Primary category**: Health & Fitness
- **Secondary category**: Productivity
- **Age rating**: 4+
- **Bundle ID**: `com.subitual.app`
- **SKU**: `ritual-ios-001`

## Promotional text (170 chars, editable without new build)

Build habits that actually stick. Earn XP, keep streaks alive, and mail your future self a note you'll get on the day it matters.

## Description (4000 chars max)

The Ritual is a calm, focused habit tracker for people who are tired of streak apps that either nag or let them off the hook. Every habit is a simple yes/no. Every day you either did it or you didn't. No fake metrics, no "almost" — just the truth, and a system that rewards you for coming back.

WHY IT'S DIFFERENT

• Earn, lose, and recover XP. Complete a habit → gain XP. Miss a day → lose some. Come back the next day → you get it back. Miss two in a row → the loss stays. It's the recovery mechanic that makes streaks forgiving without making them meaningless.

• Four difficulty tiers. You decide how hard each habit is: Easy (5 XP), Medium (10), Hard (15), or Beast (20). Drink water and morning run shouldn't be worth the same.

• Flexible schedules. Pick specific weekdays, a custom pattern, or "X times per week" and choose your days as you go.

• Photo and location proof. Attach a photo to prove you went for the run, or drop a location pin so checking in only works when you're actually there.

• Time capsules. Write a note to your future self — a promise, a memory, a pep talk — seal it with an unlock date, and get it back when the day arrives. Attach photos if you want. Open it, keep it, earn bonus XP.

• Levels and badges. Ten level thresholds from 100 XP to 10,000+. Badges for streaks, completions, proofs, and the first time you open a capsule.

• A dashboard that actually means something. Six-month heatmap, weekly bars, XP breakdown of what you earned vs. what you lost vs. what you recovered, per-habit sparklines.

• Face ID lock. Optional biometric unlock so your private log stays private.

• Fully offline-capable. Check in without signal — it syncs the moment you're back online.

PRIVACY

No ads. No trackers. No third-party analytics. Your habits, photos, and time capsules live in your own private, row-level-secured record. Photos are served via short-lived signed URLs. Face ID stays on your device. You can export or wipe everything from Profile → Advanced at any time.

GOOD FOR

• People rebuilding after a broken streak
• Gym, running, meditation, journaling, language, study habits
• Anyone who wants a tracker that's kind without being pointless

Start small. Miss a day. Come back. That's the ritual.

---

## Keywords (100 chars max, comma-separated, NO spaces after commas)

```
habit,tracker,streak,routine,goals,discipline,xp,gamify,journal,capsule,focus,daily,morning,wellness
```

_(99 chars — room to tune)_

Alternates to A/B test after launch:
- `habit,streak,tracker,routine,discipline,productivity,xp,level,goals,daily,planner,journal,ritual`
- `habit,tracker,streak,gym,gym habits,routine,discipline,goals,wellness,daily,journal,focus,capsule`

## What's new (per-release)

**v1.0.0 — Launch**
- First public release
- Binary habits, XP earn/lose/recover, four difficulty tiers
- Photo + location proof
- Time capsules with unlock dates
- Levels, badges, streak bonuses
- Face ID lock, offline sync

## Support & marketing URLs

- **Support URL**: `mailto:ctsubaz@gmail.com`
- **Marketing URL**: `https://bixudots.github.io/Ritual/`
- **Privacy policy URL**: `https://bixudots.github.io/Ritual/privacy`

## Screenshots (required sizes)

iPhone 6.9" (1320 × 2868) — **primary, required**
iPhone 6.5" (1284 × 2778) — required
iPad 13" (2064 × 2752) — only if you enable iPad

Suggested screenshot order:
1. Today screen with a half-checked habit list and streak flame
2. Dashboard — heatmap + XP bar + level badge
3. Habit detail — year heatmap + stats
4. Time capsule reveal screen (opened letter card)
5. Badge showcase grid
6. Add habit — XP difficulty picker

## App Privacy answers (Data Types)

In App Store Connect → App Privacy, answer:

- **Data linked to you**:
  - Contact Info → Email Address (app functionality)
  - User Content → Photos (app functionality) — _for capsule and proof photos_
  - User Content → Other User Content (app functionality) — _habit names, capsule messages_
  - Identifiers → User ID (app functionality)
  - Usage Data → **none** _(we don't collect)_
  - Diagnostics → **none**
- **Data not linked to you**: none
- **Tracking**: **No** — we do not track users across apps or websites

## Encryption export compliance

Already set in `app.json`:
- `ITSAppUsesNonExemptEncryption: false`
- `config.usesNonExemptEncryption: false`

You'll still be asked once in App Store Connect — answer **"No, my app does not use encryption beyond what's exempt."** (HTTPS only = exempt.)
