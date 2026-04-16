# TestFlight Release Checklist — The Ritual

A linear checklist to get from "code is ready" to "beta testers on TestFlight" to "submitted to the App Store."

---

## 0 · Prerequisites (one-time, outside the repo)

- [ ] Enrolled in the **Apple Developer Program** ($99/yr)
- [ ] Agreements + banking + tax set up in App Store Connect → Agreements
- [ ] Team ID noted (App Store Connect → Membership)
- [ ] Apple ID used for submission noted
- [ ] EAS account created: `npm i -g eas-cli && eas login`
- [ ] Node 20.18.0 installed locally (matches `eas.json` `base.node`)

---

## 1 · Repo hygiene before first build

- [ ] `npx tsc --noEmit` — clean _(already clean at time of writing)_
- [ ] `.env` is gitignored and present locally
- [ ] `.env.example` committed with placeholder values
- [ ] `app.json` bundle identifier changed from `com.ritual.app` to `com.yourcompany.ritual`
- [ ] `app.json` version = `1.0.0`, iOS `buildNumber = "1"`, Android `versionCode = 1`
- [ ] `app.json` owner/slug reviewed
- [ ] App icon assets present at `assets/icon.png` (1024×1024, no alpha, no rounding)
- [ ] Splash / adaptive icon assets present
- [ ] Fill in `eas.json` → `submit.production.ios`:
  - `appleId`
  - `ascAppId` _(get after step 3)_
  - `appleTeamId`

---

## 2 · Supabase production hardening

- [ ] Apply `supabase/migrations/010_security_hardening.sql` to the production project
- [ ] In SQL editor, spot-check:
  - `SELECT * FROM profiles` as a non-owner returns 0 rows
  - `SELECT * FROM storage.buckets WHERE id = 'capsule-photos'` shows `public = false`
  - Existing capsules still render photos in the app (signed URL path works)
- [ ] Rotate the publishable anon key if it has ever been committed to git
- [ ] Confirm auth providers enabled (email/password at minimum) + email templates customized
- [ ] Custom SMTP configured (Supabase's default is rate-limited and sends from `noreply@mail.app.supabase.io`)
- [ ] Password reset redirect URL set to your deep-link scheme

---

## 3 · Create the App Store Connect listing

Go to App Store Connect → My Apps → **+** → New App:

- [ ] Platform: iOS
- [ ] Name: `The Ritual`
- [ ] Primary language: English (U.S.)
- [ ] Bundle ID: matches `app.json` (create it in Certificates, IDs & Profiles first if needed)
- [ ] SKU: `ritual-ios-001`
- [ ] Copy the **App Store Connect App ID** into `eas.json` → `ascAppId`

Fill in the listing using `docs/APP_STORE_LISTING.md`:
- [ ] Name, subtitle, promo text, description
- [ ] Keywords
- [ ] Categories (Health & Fitness / Productivity)
- [ ] Support URL, marketing URL, privacy policy URL _(must be publicly reachable)_
- [ ] Age rating questionnaire → 4+
- [ ] App Privacy data types _(see listing doc)_
- [ ] Screenshots (6.9" required)

---

## 4 · Build

```bash
# First time only
eas init
eas credentials   # let EAS generate distribution cert + provisioning profile

# Production build
eas build --platform ios --profile production
```

- [ ] Build finishes green on EAS dashboard
- [ ] Download the `.ipa` or let EAS hand it off directly

---

## 5 · Submit to TestFlight

```bash
eas submit --platform ios --profile production --latest
```

- [ ] Apple processes the build (~5–30 min)
- [ ] Build appears under App Store Connect → TestFlight → iOS builds
- [ ] Answer the **Export Compliance** prompt: _No_ (HTTPS is exempt)
- [ ] Add test info (beta app description, feedback email, marketing URL) — required once

---

## 6 · Internal testing (your devices)

- [ ] Create an **Internal Testing** group (up to 100 people, no review needed)
- [ ] Add yourself + 1–2 teammates via App Store Connect users
- [ ] Install TestFlight app on device, accept invite
- [ ] Smoke test the P0 flows:
  - [ ] Sign up with a fresh email, confirm email arrives
  - [ ] Sign in, sign out, sign back in
  - [ ] Password reset email arrives, link opens the app, reset works
  - [ ] Create habits across all 3 schedule types + all 4 XP tiers
  - [ ] Complete a habit, miss a habit, come back next day and verify recovery math
  - [ ] Take a photo proof — photo uploads and renders via signed URL
  - [ ] Set a location-verified habit and check in on-site + off-site
  - [ ] Create a time capsule with photos, sealed for tomorrow
  - [ ] (Dev only) Backdate capsule unlock to verify reveal + Keep vs Delete flow
  - [ ] Earn a badge, verify celebration animation fires
  - [ ] Hit a 7-day streak, verify bonus XP lands
  - [ ] Change avatar icon in Profile → verify it updates on Home + Dashboard + Capsules immediately
  - [ ] Enable Face ID lock, background app, re-open, verify prompt
  - [ ] Reset data from Profile → Advanced, verify account persists but data wipes
  - [ ] Delete account from Profile → Advanced, verify full wipe + sign-out
  - [ ] Offline: airplane mode → complete habits → go online → verify sync
  - [ ] Supabase row-check: log in as user A, verify you cannot read user B's rows from the SQL editor while signed in as A

---

## 7 · External testing (public beta)

- [ ] Create an **External Testing** group (up to 10,000 testers)
- [ ] Apple reviews the first external build (usually <24h)
- [ ] Add testers by email or generate a public TestFlight link
- [ ] Collect feedback via in-app feedback / TestFlight screenshots
- [ ] Triage + push follow-up builds (`eas build` bumps `buildNumber` automatically because of `autoIncrement: true`)

---

## 8 · Submit for App Review

When external beta is stable:

- [ ] Version = `1.0.0`, build selected in App Store Connect → Distribution
- [ ] Fill the **App Review Information** block: demo account credentials (create a seeded test user), contact phone + email, notes for the reviewer if any gotchas exist
- [ ] Export compliance: No
- [ ] Content rights: You own or have licensed all content
- [ ] Advertising identifier: **No**
- [ ] Release: Manual OR automatic after approval — pick one
- [ ] Click **Add for Review** → **Submit for Review**

Typical review turnaround: 24–48h. Common rejection reasons to pre-empt:
- Missing demo account → we give them one
- Privacy policy URL 404 → host it before submitting
- Permission strings too vague → ours are specific (`app.json`)
- Crash on launch → caught in TestFlight first

---

## 9 · Post-launch

- [ ] Watch App Store Connect → Crashes for the first 72h
- [ ] Watch Supabase → Auth → Users for signup funnel
- [ ] Watch Supabase → Logs → API for 401/403 spikes (RLS regressions)
- [ ] Prepare a 1.0.1 branch for the inevitable first hotfix
