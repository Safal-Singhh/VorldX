# Employee app test plan (Android phone and iOS simulator)

Manual checks for `apps/employee-mobile` before the internship evaluation. Run the same list on
both devices and record the result in the table at the end.

Fixtures: use the QA company accounts from `docs/test-report.md` (for example
`p5a-20261021a-a-emp@example.com`, password `QaTest!2345`) or a real employee invite.

## Seeded QA scenario

On 2026-10-21 the QA employee above was given a small data set so every screen has content
(refreshed 2026-10-22 so the WFH passcode is valid for the test day):

| Data | Value |
| --- | --- |
| Attendance | 2026-10-14 present, 2026-10-15 present, 2026-10-16 WFH, 2026-10-19 late, 2026-10-20 present |
| WFH | approved request for 2026-10-22 with passcode `482915` (2 uses left), pending request for 2026-10-23 |
| Leave | approved for 2026-10-30, pending for 2026-10-27 |
| Feedback | one review for September 2026 with five criterion scores |

The WFH passcode for 2026-10-22 expires at `2026-10-22T23:59:59Z` (05:29 on 2026-10-23 IST), the same
expiry the Admin passcode generator produces. Ask for a re-seed if testing happens on a later day.

## Setup

Android (physical phone):

1. `npx expo start` and open the QR code in Expo Go, or install the `preview` APK from EAS.
2. Allow camera permission when the Scan tab asks.

iOS (simulator through EAS):

1. `npx eas-cli@latest login` (Expo account), then
   `npx eas-cli@latest build --profile ios-simulator`.
2. Upload the `.app` artifact to a hosted simulator (Appetize.io or a cloud Mac) and open it.
3. The simulator has no camera, so the Scan tab must show the "camera needs a physical phone"
   fallback there. Everything else should behave the same.

## Checks

| ID | Check | Steps | Expected |
| --- | --- | --- | --- |
| MT-01 | Launch | Open the app. | Splash fades into the login screen; no red error screen. |
| MT-02 | Employee sign-in | Sign in with an employee account. | Dashboard loads with name, greeting and today's card. |
| MT-03 | Role gate | Sign out, sign in as an Admin or HR account. | Access denied message; Admin/HR must use the web dashboard. |
| MT-04 | Dashboard | Inspect hero card, stat tiles, shift card, week chart, month donut, pending list. | All render; orb animates (static when the system reduce-motion setting is on). |
| MT-05 | Quick actions | Tap each quick action on the dashboard. | Opens Scan, WFH, Requests and Attendance. |
| MT-06 | Office scan (Android only) | Open Scan, allow camera, point at a live VorldX display. | Check-in recorded; second scan checks out; expired QR shows an error. |
| MT-07 | Scan fallback (iOS simulator) | Open Scan on the simulator. | Explains the camera needs a physical phone and offers the WFH tab. |
| MT-08 | WFH check-in | With an approved request for today, open WFH and tap "Check in with passcode". | Success notice; 1 use left; dashboard shows WFH active. |
| MT-09 | WFH check-out | Tap "Check out with passcode". | Success notice; passcode shows Used; day complete. |
| MT-10 | WFH third use | Try the passcode again (manual entry). | Rejected with a friendly message; no new row. |
| MT-11 | WFH request | Requests tab -> WFH -> pick tomorrow -> submit. | Success; request appears as pending; cutoff note respected. |
| MT-12 | Leave request | Requests tab -> Leave -> submit one date and reason. | Success; pending list shows it; usage meter moves. |
| MT-13 | Leave limit | Submit a fourth request in the same month. | Rejected: 3 pending or approved per month. |
| MT-14 | Attendance calendar | Open My attendance. | Marks for present, late, WFH and leave; month navigation works; day details match the log. |
| MT-15 | Feedback | Open My feedback. | Ratings and comments render read-only, or the empty state shows. |
| MT-16 | Policies | Open Policies. | WFH, shift, leave and check-in rules match the web dashboard; no editing. |
| MT-17 | Profile | Open Profile, check details and shift card. | Values match the web employee record. |
| MT-18 | Change password | Change password with a wrong current password, then a correct one. | Wrong current password shows an error; correct change succeeds and the new password works after sign-out. |
| MT-19 | Forgot password | On the login screen, tap "Forgot password". | Opens the web reset page in the browser. |
| MT-20 | Offline reads | Load the dashboard, enable airplane mode, reopen the app. | Cached attendance and requests stay readable; a banner or stale data is acceptable, no crash. |
| MT-21 | Clear cache | Profile -> Clear offline data. | Confirmation dialog; cache removed; data reloads when online. |
| MT-22 | Sign out | Profile -> Sign out. | Confirmation dialog; returns to login; back button cannot re-enter. |
| MT-23 | Responsive | Test portrait phone, landscape phone, and a tablet or wide window (web preview works for layout). | Content is readable at every size; wide layouts get the side rail; no clipped text. |
| MT-24 | Keyboard | Open each form and focus every field. | Keyboard does not cover the submit button; inputs stay reachable. |

## Results

Fill in `Pass`, `Fail` or `N/A` per device, and add notes for anything unexpected.

| ID | Android phone | iOS simulator | Notes |
| --- | --- | --- | --- |
| MT-01 | | | |
| MT-02 | | | |
| MT-03 | | | |
| MT-04 | | | |
| MT-05 | | | |
| MT-06 | | | |
| MT-07 | | | |
| MT-08 | | | |
| MT-09 | | | |
| MT-10 | | | |
| MT-11 | | | |
| MT-12 | | | |
| MT-13 | | | |
| MT-14 | | | |
| MT-15 | | | |
| MT-16 | | | |
| MT-17 | | | |
| MT-18 | | | |
| MT-19 | | | |
| MT-20 | | | |
| MT-21 | | | |
| MT-22 | | | |
| MT-23 | | | |
| MT-24 | | | |
