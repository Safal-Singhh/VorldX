# VorldX --- UI/UX Design System & Implementation Guide

> **Purpose:** This file is the visual and interaction source of truth
> for the VorldX Employee Attendance System. Follow it when building the
> website, dashboards, QR display, and---only after the web/backend
> phases are complete---the React Native employee app.
>
> **Design direction:** Premium dark operations console + macOS-inspired
> liquid glass + restrained indigo/blue lighting. The product must feel
> like a modern infrastructure SaaS platform, not a dated HR attendance
> template.

------------------------------------------------------------------------

## 1. Product experience principles

### 1.1 The intended feeling

VorldX should feel precise, calm, high-tech, and trustworthy. Take
visual cues from the referenced Dribbble **GPU Cloud Provisioning
Dashboard**: deep near-black surfaces, indigo accents, muted periwinkle,
disciplined data hierarchy, readable dense information, compact
technical labels, and small status colors. Adapt the design language to
attendance and people operations; do **not** copy the reference layout
pixel-for-pixel.

The reference palette lists:

-   `#07080E` --- near-black base
-   `#1D2158` --- deep indigo
-   `#585E94` --- muted indigo/periwinkle
-   `#393E2A` --- muted olive accent
-   `#9194BA` --- soft lavender
-   `#484C59` --- slate gray

Use these as inspiration, not as a requirement that every color appear
equally. Keep the olive tone rare; it is not a primary brand color. The
dominant visual should be black/navy with indigo-blue lighting.

### 1.2 Core design rules

1.  **Dark-first, not black-on-black.** Separate page canvas, sidebar,
    cards, and overlays through small shifts in hue, translucency, and
    border brightness.
2.  **Glass is a material, not a gimmick.** Use liquid-glass treatment
    for hero surfaces, stat cards, dropdowns, dialogs, and selected
    panels. Do not put every table cell inside a glass pill.
3.  **Data readability beats decoration.** Attendance times, status
    labels, dates, employee names, and approval actions must remain
    immediately legible.
4.  **One clear primary action per view.** Examples: "Add employee",
    "Approve request", "Pair display", "Save review".
5.  **Motion explains state.** Use animation to communicate loading,
    navigation, selection, success, and live QR refresh---not to make
    every element move continuously.
6.  **Consistent system across roles.** Admin and HR should share the
    same components, with role-specific navigation and actions.
7.  **Accessible by default.** Preserve keyboard navigation, visible
    focus, sufficient contrast, reduced-motion preferences, and usable
    touch targets.

------------------------------------------------------------------------

## 2. Color system

Create design tokens in CSS variables and reuse them in Tailwind theme
configuration. Avoid scattering raw hex values across components.

### 2.1 Brand palette

  -----------------------------------------------------------------------------
  Token                   Hex                           Intended use
  ----------------------- ----------------------------- -----------------------
  `--vx-bg`               `#07080E`                     Main application canvas

  `--vx-bg-raised`        `#0D101B`                     Raised page regions and
                                                        top bars

  `--vx-sidebar`          `#0A0C15`                     Navigation sidebar

  `--vx-indigo-deep`      `#1D2158`                     Deep indigo surfaces,
                                                        selected panel glow

  `--vx-indigo`           `#5965F2`                     Primary action and
                                                        active navigation; use
                                                        sparingly

  `--vx-indigo-muted`     `#585E94`                     Secondary accent and
                                                        chart series

  `--vx-lavender`         `#9194BA`                     Muted highlights,
                                                        labels, subtle chart
                                                        accents

  `--vx-olive-muted`      `#393E2A`                     Rare
                                                        decorative/secondary
                                                        data accent only

  `--vx-slate`            `#484C59`                     Neutral borders and
                                                        muted surface details

  `--vx-surface`          `rgba(20, 23, 39, 0.72)`      Standard glass-card
                                                        surface

  `--vx-surface-strong`   `rgba(17, 20, 34, 0.92)`      Dense tables and
                                                        important panels

  `--vx-border`           `rgba(184, 190, 255, 0.13)`   Default glass border

  `--vx-border-active`    `rgba(133, 145, 255, 0.42)`   Focused/selected
                                                        borders

  `--vx-text`             `#F4F5FF`                     Primary text

  `--vx-text-secondary`   `#B3B7CE`                     Secondary text

  `--vx-text-muted`       `#7E849E`                     Timestamps, hints,
                                                        metadata

  `--vx-success`          `#45D6A6`                     Present, approved,
                                                        healthy

  `--vx-warning`          `#F5C76B`                     Late, pending,
                                                        attention needed

  `--vx-danger`           `#FF6B83`                     Rejected, failed,
                                                        destructive actions

  `--vx-info`             `#76B8FF`                     Informational states
  -----------------------------------------------------------------------------

### 2.2 Color usage

-   The **primary action** is indigo, with a subtle gradient allowed:
    `#5965F2 → #777BFF`.
-   Use success/warning/danger only for status meaning, never as random
    decoration.
-   Do not use bright blue for every icon, border, chart, and button.
    Indigo should guide attention.
-   Keep text contrast strong on glass. If blur or transparency reduces
    contrast, increase the surface opacity.
-   Charts must use distinguishable series and include labels/legends;
    color alone must not convey status.
-   Avoid pure white backgrounds and generic Bootstrap-blue buttons.

### 2.3 Background atmosphere

Use a mostly still near-black canvas with two or three very subtle
radial gradients: indigo behind the main dashboard header, muted
blue-violet in one far corner, and a very faint cool-gray haze.
Background effects should not reduce contrast or distract from records.
Do not animate large gradient fields continuously.

------------------------------------------------------------------------

## 3. Typography, numbers, spacing, and shape

### Typography

-   **UI font:** `Inter` or `Geist Sans` (choose one and use it
    consistently).
-   **Technical numerals:** `Geist Mono` or `JetBrains Mono` for
    employee IDs, timestamps, QR countdown, audit identifiers, and
    compact metric values.
-   Use clear hierarchy: page title 26--32 px; section title 16--20 px;
    body 14--16 px; metadata 12--13 px.
-   Avoid ultra-thin text on dark backgrounds. Use medium/semibold for
    important labels.
-   Use tabular numerals for times, dates, counts, and chart labels so
    they do not jump as values change.

### Spacing

Use a 4 px base spacing scale. Common gaps: 8, 12, 16, 20, 24, 32 px.
Dashboard content should feel breathable without wasting vertical space.

### Radius

-   Small controls: 10--12 px
-   Inputs and standard cards: 14--18 px
-   Feature/hero glass cards: 20--26 px
-   Modals: 20--24 px
-   Pills: fully rounded only for compact status badges and tags

### Borders and shadows

Use fine 1 px borders with cool, low-opacity tints. Shadows should be
broad and subtle, with indigo-tinted ambient light only on highlighted
surfaces. Avoid heavy black drop shadows that make cards look like
floating boxes.

------------------------------------------------------------------------

## 4. Liquid-glass material specification

Create reusable variants rather than hand-styling each card.

### `GlassPanel`

-   Background: `rgba(20, 23, 39, 0.66–0.78)`
-   `backdrop-filter: blur(18px) saturate(135%)`
-   Border: `1px solid rgba(184, 190, 255, 0.13)`
-   Inner highlight: faint top-edge gradient
-   Shadow: soft, wide, low opacity
-   Optional pseudo-element: a subtle blurred indigo glow in one corner
-   Radius: 18--24 px

### `GlassPanelStrong`

Use for tables, forms, and high-density panels. Increase opacity to
`0.90–0.96`, reduce blur, and maintain clear separators. Never let text
from the background show through a table.

### `GlassInteractive`

On hover/focus: - border brightens slightly; - panel rises by only 1--2
px; - a soft highlight fades in; - transition 180--240 ms. Do not add
scale to every clickable card. Use scale only for small icon buttons or
decorative elements where it does not shift layout.

### `GlassModal`

Use a dark scrim, strong surface opacity, blur behind the dialog, clear
heading, concise explanation, and one primary action. Destructive
actions require a confirmation step.

### Fallbacks

If `backdrop-filter` is unsupported or expensive, fall back to a solid
dark surface with a fine border. The interface must remain attractive
and readable without blur.

------------------------------------------------------------------------

## 5. Application shell and layout

### Desktop dashboard shell

-   Fixed or sticky left sidebar: 236--256 px.
-   Main content: fluid, max-width as needed for dense tables.
-   Top bar: breadcrumb/title context, global search if useful,
    notification entry, profile menu.
-   Page content begins with title + short supporting sentence + primary
    action.
-   Use a 12-column grid for dashboard modules; allow cards to span 3,
    4, 6, or 8 columns.
-   Tables should occupy the full available width and scroll
    horizontally only when necessary.
-   Use a compact, consistent icon family such as Lucide. Use outline
    icons consistently.

### Sidebar

-   VorldX mark and wordmark at the top.
-   Role label: `ADMIN CONSOLE` or `HR WORKSPACE`.
-   Group navigation into Overview, People, Attendance, Requests,
    Feedback, and Settings.
-   Active route: muted indigo panel, a thin left indicator, brighter
    label, and icon.
-   Collapsed state may be added later; do not make it the first
    priority.
-   Sidebar animations should be restrained; do not animate the entire
    navigation on every route change.

### Responsive behavior

-   Desktop: full sidebar and multi-column dashboard.
-   Tablet: narrower sidebar or collapsible navigation; tables preserve
    key columns.
-   Mobile website: sidebar becomes a drawer, KPI cards stack, filters
    move into a filter sheet, and tables become compact row cards where
    needed.
-   Do not confuse mobile website responsiveness with the React Native
    app; the app is a later implementation phase.

------------------------------------------------------------------------

## 6. Page-by-page UI requirements

## 6.1 Public company portal and authentication

### Company signup

-   Minimal focused layout, not a marketing-heavy landing page.
-   Dark atmospheric background with a restrained indigo glow.
-   Centered glass form panel with VorldX logo, heading, short
    explanation, and progress/validation feedback.
-   Fields: company name, Admin full name, work email, password, confirm
    password.
-   Password visibility toggle, inline validation, clear error messages,
    disabled/loading submit state.
-   Explain that this signup creates the initial Admin account.
-   Show legal/privacy links only if real destinations exist.

### Login and password recovery

-   Same visual language and form dimensions.
-   Email/password, show/hide password, forgot-password link, loading
    state.
-   Errors should be specific enough to help but must not reveal whether
    an arbitrary email belongs to a company.
-   Password reset page clearly shows expired-link and success states.

### HR/employee activation

-   Explain that access requires a pre-created record or invitation.
-   Company selector should list only eligible companies, not expose
    private company membership information.
-   Show a clear "Contact your HR/Admin" empty state when no matching
    employee invitation exists.

## 6.2 Admin dashboard

### Dashboard overview

-   Header: "Good morning/afternoon" optional; prioritize a concise
    "Company overview".
-   KPI glass cards:
    -   Active employees
    -   HR accounts
    -   Present today
    -   Late today
    -   WFH today
    -   Pending HR WFH requests
-   Each KPI includes a clear label, current value, small context line,
    and restrained trend indicator only if meaningful historical data
    exists.
-   Main row: attendance trend chart and office-vs-WFH breakdown.
-   Secondary row: pending HR WFH requests, QR display health, recent
    activity/audit events.
-   Avoid fake trends or invented percentages in production; seeded demo
    data must be labelled as demo data.

### HR management

-   Searchable table: name, email, department, status, created/invited
    date, last activity if available.
-   Primary action: "Add HR" / "Invite HR".
-   Row actions in an overflow menu: view details, resend invite,
    deactivate.
-   Use a side panel or modal for create/edit forms; show clear
    invitation status.
-   Confirm before deactivation and explain consequences.

### Company settings and global policies

-   Group settings into Company profile, Work schedule, Attendance
    rules, WFH rules, and Security.
-   Admin-only editing.
-   WFH cutoff displayed as "120 minutes before assigned shift".
-   Grace period, working days, timezone, shift rules, and WFH
    eligibility should have helper text.
-   Unsaved changes indicator and save confirmation.
-   HR policy screen is read-only and should visually communicate that
    policies are managed by Admin.

### HR WFH requests

-   Filters: date, status, requester, department if relevant.
-   Request cards/table show requester, requested date, shift, reason,
    submitted time, and deadline validation status.
-   Detail drawer shows full reason and approval history.
-   Approve/reject actions require deliberate click; rejection may
    include reviewer notes.
-   On approval, expose passcode-generation action only to authorized
    roles and display passcode securely. Do not show plaintext passcodes
    in general list views or logs.

### QR display management

-   List paired displays with display name, office, active state, last
    seen, and pairing status.
-   Admin can pair, disable, or revoke a display.
-   Explain that each QR session expires after 18 seconds.
-   Show technical status clearly without exposing raw QR tokens or
    secrets.
-   A "View display" action opens the dedicated QR display page.

### HR feedback

-   Select HR subject, review period, criterion ratings (0--10), and
    written comments.
-   Display previous reviews for context without making the form
    cluttered.
-   Clearly identify the review period and reviewer before submission.

## 6.3 HR dashboard

### Overview

-   KPI cards: total active employees, present today, late today, WFH
    today, pending employee requests.
-   Attendance chart with date range and department filters.
-   Pending WFH requests list with quick review actions.
-   Recent attendance activity and team summary.
-   Never expose another company's data or unrelated personal profile
    information.

### Employee management

-   Table columns: employee ID, name, department, designation, shift,
    work type, status.
-   "Add employee" opens a structured form grouped into Identity, Job
    details, Work schedule, and Account activation.
-   Use clear field labels and inline validation.
-   Employee record can exist before the employee creates an account.
-   Employee detail view: profile summary, assigned shift, attendance
    history, WFH requests, feedback history where authorized.
-   Deactivation should preserve historical attendance and feedback.

### Attendance management

-   Filters: date range, employee, department, status, attendance type,
    late/present.
-   Table includes employee, work date, type (Office/WFH), check-in,
    check-out, duration, status, and source.
-   Use tabular numerals for timestamps.
-   Missing check-out is shown as "In progress" or "Incomplete"; do not
    invent a duration.
-   Corrections, if supported, require a reason and an audit entry.
-   Export controls should only be shown if export functionality is
    actually implemented.

### WFH review queue

-   Separate Pending, Approved, Rejected tabs or segmented controls.
-   Show deadline, reason, shift, requester, and review state.
-   Approve/reject in a detail drawer with a confirmation state.
-   Employee WFH requests are reviewed by HR. HR requests are reviewed
    by Admin; the HR interface must not show an approval action for its
    own request.

### Employee feedback

-   Choose review period using a date-range picker.
-   Rate each criterion from 0 to 10 with an accessible input (slider
    plus numeric value, or a segmented rating control).
-   Criteria: Punctuality, Attendance & Consistency, Teamwork &
    Collaboration, Adaptability, Accountability.
-   Provide a written-comments area.
-   Include a preview step or clear summary before submission.
-   Show submitted reviews as read-only unless an authorized correction
    workflow is designed.

### Policies

-   Read-only page with the current company rules, cutoff time, assigned
    shift policy, and effective date.
-   Make it obvious that only Admin can edit global policy settings.

## 6.4 Office QR display

This is a dedicated, presentation-quality screen intended to be visible
on an office monitor.

-   Full-screen near-black/navy canvas with a restrained animated indigo
    ambient glow.
-   Centered VorldX identity and office/display name.
-   Large, high-contrast QR code in a light neutral square or bright
    glass panel; QR must scan reliably.
-   Visible countdown ring/bar and "Refreshes in 18s".
-   Connection status: Connected, Refreshing, Offline, or Display
    disabled.
-   Small timestamp for "Last refreshed".
-   QR itself must have enough quiet zone and no decorative overlay that
    interferes with scanning.
-   Avoid parallax, 3D rotations, blur over the QR, and excessive
    animation near the code.
-   If refresh fails or the session expires, obscure/replace the old QR
    with an expired state; do not leave it looking valid.
-   QR validity is enforced by the backend, never only by the countdown
    UI.

## 6.5 Attendance detail and feedback visualizations

-   Use clear line/bar charts with visible axes, legends, tooltips, and
    empty states.
-   Attendance charts: present/late/WFH by day; office vs WFH;
    punctuality trends.
-   Feedback charts: criterion scores by review period and historical
    trend.
-   Keep attendance metrics separate from subjective feedback ratings
    unless a documented formula is explicitly introduced.
-   Do not rely on red/green alone; pair color with text labels/icons.
-   Chart animations should be short and should not replay every time a
    small filter changes.

## 6.6 Employee mobile app --- build last

Use the same brand tokens and typography, adapted to native touch
patterns. Do not simply shrink the desktop website into a phone layout.

-   Home: greeting, today's status, check-in/check-out action, shift
    details, quick WFH request status.
-   Attendance: camera-based QR scanner, scan feedback, exact timestamp
    confirmation, history and filters.
-   WFH: request form, reason, request status, approval details,
    passcode entry after approval.
-   Feedback: review cards, rating breakdowns, comments, trend chart.
-   Profile: personal/employment details, avatar, logout, biometric
    unlock settings.
-   Use native permission prompts and graceful camera-denied states.
-   Biometric unlock protects an existing authenticated session; it is
    not a substitute for backend authorization.
-   Mobile haptics and transitions should be subtle and functional.

------------------------------------------------------------------------

## 7. Motion design: Framer Motion, GSAP, and Three.js

Use each library for the job it does best. Do not use all three to
animate the same component.

### 7.1 Framer Motion / Motion for React

Use for everyday interface motion: - page and route transitions; - card
entrance with short opacity/y movement; - dropdowns, dialogs, tooltips
and side panels; - tab/segmented-control transitions; - list
insert/remove; - button feedback and status changes.

Guidelines: - Typical duration: 160--280 ms for UI; 300--450 ms for
larger panel transitions. - Use restrained easing such as
`[0.22, 1, 0.36, 1]`. - Stagger dashboard elements lightly; never delay
access to important actions. - Respect `prefers-reduced-motion`. - Avoid
bounce-heavy spring motion in enterprise workflows.

### 7.2 GSAP

Use for a small number of orchestrated sequences: - public/auth entry
reveal; - first dashboard load sequence; - QR countdown/progress ring if
a custom timeline is genuinely needed; - a rare onboarding or
empty-state illustration. - Use scoped contexts and clean up timelines
on unmount. - Avoid running GSAP and Motion against the same DOM
properties on the same element. - Avoid continuous animation loops on
dashboard cards.

### 7.3 Three.js / React Three Fiber

Three.js is optional and should be used sparingly. Suitable uses: - a
subtle abstract 3D orb, glass prism, or wireframe field on the public
portal/login background; - a low-contrast decorative 3D element on an
empty state or onboarding screen; - a small branded visual in a
non-critical area.

Do **not** use a full-screen 3D scene behind attendance tables, forms,
QR codes, or charts. It harms readability and wastes GPU/battery. Do not
use 3D to represent the live QR code.

Implementation guidance: - Prefer React Three Fiber if integrating 3D
with React. - Lazy-load the scene and keep it out of the critical
rendering path. - Limit geometry, shaders, particle count, draw calls,
and device pixel ratio. - Pause rendering when the scene is off-screen
or the tab is inactive where feasible. - Provide a static CSS fallback
for low-power devices and reduced-motion users. - If 3D adds little to
the experience, omit it; strong surface design is better than decorative
complexity.

### 7.4 Suggested motion timings

  -----------------------------------------------------------------------
  Interaction                                                      Timing
  ------------------------------ ----------------------------------------
  Button hover/focus                                          120--180 ms

  Card border/glow                                            180--240 ms

  Dropdown/modal                                              180--280 ms

  Page transition                                             220--320 ms

  Dashboard entrance sequence                350--600 ms total, staggered

  Chart reveal                                                250--450 ms

  QR refresh state                 driven by real 18-second server-issued
                                                        session lifecycle
  -----------------------------------------------------------------------

The 18-second QR lifetime is a backend rule. Animation is only a visual
representation of the remaining lifetime and must never determine
validity.

------------------------------------------------------------------------

## 8. Recommended frontend stack

### Website

-   React + Vite + TypeScript
-   Tailwind CSS with CSS variables/design tokens
-   React Router
-   Motion for React (`motion/react`, formerly Framer Motion)
-   GSAP for the few orchestrated sequences described above
-   Three.js with React Three Fiber only for selected decorative 3D
-   Lucide React icons
-   Recharts for charts
-   React Hook Form + Zod for forms and validation
-   Supabase JS client for authorized data operations

### Employee app --- later phase

-   React Native + Expo + TypeScript
-   `expo-camera` for QR scanning
-   `expo-local-authentication` for device-local biometric unlock
-   Native navigation and touch feedback
-   Shared brand tokens and product terminology where practical

Do not add libraries just because they are fashionable. Every dependency
should have a clear role and should not duplicate another library's
responsibility.

------------------------------------------------------------------------

## 9. Interaction states and component checklist

Every interactive component must support:

-   Default
-   Hover (where applicable)
-   Keyboard focus
-   Pressed/active
-   Loading
-   Success
-   Error
-   Disabled
-   Empty state, when relevant

Required reusable components: - `AppShell`, `Sidebar`, `Topbar`,
`PageHeader` - `GlassPanel`, `GlassStatCard`, `GlassDialog`,
`GlassDropdown` - `PrimaryButton`, `SecondaryButton`, `IconButton` -
`StatusBadge`, `Avatar`, `Tooltip` - `DataTable`, `FilterBar`,
`DateRangePicker`, `SearchInput` - `FormField`, `PasswordField`,
`RatingInput` - `AttendanceTimeline`, `QRCountdown`, `QRDisplayStatus` -
`FeedbackRatingForm`, `AttendanceChart`, `FeedbackTrendChart` -
`LoadingSkeleton`, `EmptyState`, `ErrorState`, `Toast`, `ConfirmDialog`

Do not create a separate visual style for every page. Build these
primitives once and compose them consistently.

------------------------------------------------------------------------

## 10. Accessibility, responsiveness, and performance

-   Maintain readable text contrast on translucent backgrounds; verify
    actual rendered combinations.
-   All controls must work with keyboard and screen readers where
    applicable.
-   Provide visible focus indicators; do not remove browser focus
    outlines without replacing them.
-   Respect reduced motion; remove parallax, animated backgrounds, and
    nonessential transitions when requested.
-   Keep touch targets comfortable, especially on mobile.
-   Avoid color-only status communication.
-   Lazy-load 3D, charts below the fold, and non-critical imagery.
-   Avoid expensive blur on large full-screen regions and numerous
    nested glass layers.
-   Use skeletons for loading and stable layout dimensions to prevent
    layout shift.
-   Use pagination or virtualization for large attendance tables.
-   Use real data and clear empty states; never ship fabricated
    production metrics.
-   Ensure the QR is high contrast, sufficiently large, and not covered
    by animation.
-   Test on a lower-powered laptop and mid-range mobile device, not only
    a high-end development machine.

------------------------------------------------------------------------

## 11. Content and microcopy style

Use concise, calm, specific language. The product should sound
professional, not robotic or overly playful.

Preferred examples: - "Attendance recorded at 09:02 AM." - "This QR
session has expired. Scan the current code." - "Your WFH request is
awaiting HR approval." - "Passcode verified. WFH attendance has been
recorded." - "No attendance records match these filters." - "Only an
Admin can change company-wide policies."

Avoid vague success messages like "Done!" for important operations.
Always identify what changed and, where useful, when it happened.

------------------------------------------------------------------------

## 12. Do not do these things

-   Do not use a generic Bootstrap dashboard template or default
    blue/white HR theme.
-   Do not put every component inside a translucent blurred card.
-   Do not use neon gradients on every button, border, icon, and chart.
-   Do not add spinning 3D objects behind dense tables or the QR code.
-   Do not animate all KPI numbers continuously.
-   Do not make the UI depend on hover; touch devices must work.
-   Do not use fake graph values or made-up trend percentages with real
    company data.
-   Do not let frontend-only role checks stand in for backend security.
-   Do not use the QR countdown as proof that a token is valid.
-   Do not build the employee app before the backend, Admin/HR website,
    QR display, and integration testing are complete.
-   Do not sacrifice clarity for a Dribbble-style screenshot. This is an
    operational product used to make real attendance decisions.

------------------------------------------------------------------------

## 13. Implementation order and design handoff

Follow the project's confirmed implementation order:

1.  **Backend foundation:** Supabase schema, Auth, company signup,
    roles, RLS, seed data and core business rules.
2.  **Admin website:** company setup, HR management, global policies, HR
    WFH approvals, QR display management, HR attendance and feedback.
3.  **HR website:** employee management, employee WFH approvals,
    attendance filters, personal attendance and feedback reviews.
4.  **Office QR display:** pairing, 18-second session rotation, expiry
    handling, status UI and attendance integration.
5.  **Integration and testing:** connect all website flows to Supabase;
    test role permissions, attendance, WFH, chart accuracy, error cases
    and security.
6.  **Employee mobile app:** React Native + Expo app with activation,
    biometrics, QR scanning, WFH, history, feedback and statistics.
7.  **Final deployment and documentation:** deploy website/mobile app,
    verify production configuration, run end-to-end tests and finish the
    project report.

### Definition of design completion

A screen is not complete just because it looks good in a screenshot. It
must: - use the shared tokens and reusable components; - work at
desktop, tablet and mobile website widths; - include loading, empty,
error, success and disabled states as appropriate; - support keyboard
focus and reduced motion; - use real data and consistent terminology; -
preserve all role and authorization rules; - remain legible when glass
blur or 3D effects are disabled.

------------------------------------------------------------------------

## 14. Reference and design interpretation

Primary visual reference: [GPU Cloud Provisioning Dashboard --- Hatypo
Studio on
Dribbble](https://dribbble.com/shots/27789860-GPU-Cloud-Provisioning-Dashboard).

The reference uses a deep dark palette with indigo and muted periwinkle,
with information hierarchy designed for operational metrics and status
scanning. VorldX should carry that restrained technical mood into
attendance and people operations, then add macOS-inspired glass surfaces
and selective motion. The result should feel like a cohesive product
design system---not a direct copy of the reference.

**Final instruction to the implementation agent:** Treat this document
as the UI/UX contract. Preserve the existing VorldX requirements and
workflow rules. Do not change product behavior to accommodate an
animation or visual effect. Build the backend and website first; the
employee app is the final application phase.
