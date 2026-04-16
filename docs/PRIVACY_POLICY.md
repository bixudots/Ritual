# Privacy Policy — The Ritual

_Last updated: 2026-04-16_

The Ritual ("we", "us", "the app") is a habit tracking app. This policy explains what data we collect, why, and how you can control it. We try to collect as little as possible.

## Who we are

The Ritual is operated by **Subash Luitel Sharma**, an independent developer. If you have questions about this policy, contact us at **ctsubaz@gmail.com**.

## The short version

- We store your account, habits, completions, XP, streaks, badges, and time capsules on Supabase so they sync between your devices.
- We don't sell your data. We don't run ads. We don't use third-party analytics.
- Camera and location access are only used when you explicitly add photo or location proof to a habit.
- You can export or delete all of your data from the app, at any time.

## What we collect and why

### Account data
- **Email address and password** — to sign you in. Authentication is handled by Supabase Auth; we never see your raw password.
- **Display name** (optional) — shown in your own profile.

### Habit data
- **Habits you create** (name, icon, schedule, XP value, target location if you set one)
- **Daily completion logs** — which habits you completed on which day
- **XP events and streak history** — to power the dashboard
- **Badges you earn**
- **Time capsules you write** (title, message, optional photos, delivery date)

All of the above is stored in your own private, row-level-secured record on Supabase. Other users cannot read it.

### Device data
- **Photos you attach as habit proof or to a time capsule** — uploaded to a private Supabase Storage bucket scoped to your user folder. Signed URLs used to display them expire after one hour.
- **Location coordinates** — only sampled when you complete a habit that has a location requirement. We compare the sample against the habit's target radius and store only the lat/lng of the check-in on that log row.
- **Face ID / Touch ID / biometric** — handled entirely by your device's secure enclave. We never receive biometric data; we only receive a yes/no "unlock succeeded" signal.

### What we do NOT collect
- No advertising identifiers
- No contact book / address book
- No browsing history
- No microphone access
- No health/fitness data beyond the habits you type in yourself
- No third-party analytics SDKs
- No crash reporters with PII

## How your data is used

- To operate the app — sync your habits, calculate XP, show your dashboard, deliver your time capsules on their unlock date.
- To authenticate you when you sign in.
- To let you recover your account via Supabase's password reset flow.

We do not use your data for advertising, for profiling, or for training machine-learning models.

## Sharing

We do not sell or rent your personal data to anyone. We share data only with:

- **Supabase** — our database, auth, and storage provider. Data is stored in Supabase's infrastructure under our project. See supabase.com/privacy for their policy.
- **Apple App Store / Google Play** — for app distribution, in-app purchase receipts (if applicable), and crash reporting you opt into at the OS level.
- **Law enforcement** — only if required by a valid legal request.

## Where your data lives

Data is stored on Supabase's servers. You can find the region your project runs in from your account dashboard once you sign up. We don't transfer data to third parties for processing.

## Your rights and controls

Inside the app, you can at any time:
- **Edit or delete individual habits, logs, and time capsules** from their detail screens
- **Reset all app data** from Profile → Advanced → Reset data (keeps your account)
- **Delete your account** from Profile → Advanced → Delete account (wipes all of your data and signs you out immediately)

Depending on where you live, you may also have the right to:
- Request a copy of your data
- Correct inaccurate data
- Ask us to delete your data
- Object to or restrict certain processing
- Lodge a complaint with your local data protection authority

Email **ctsubaz@gmail.com** and we'll respond within 30 days.

## Children

The Ritual is not directed at children under 13 (or the minimum digital-consent age in your country). We do not knowingly collect data from them. If you believe a child has created an account, email us and we will delete it.

## Security

- All traffic between the app and Supabase is encrypted via HTTPS/TLS.
- Row Level Security policies on every table restrict reads and writes to the owning user.
- Habit proof photos and time-capsule photos are stored in private buckets; displayed via short-lived signed URLs.
- If biometric lock is enabled, the app cannot be opened after backgrounding without Face ID / Touch ID.

No system is perfectly secure. If you discover a vulnerability, email **ctsubaz@gmail.com** and we will acknowledge within 72 hours.

## Changes to this policy

If we change this policy, we'll update the "Last updated" date at the top and, for material changes, show an in-app notice before the change takes effect.

## Contact

**Subash Luitel Sharma**
**ctsubaz@gmail.com**
