# VorldX Employee Attendance System

An enterprise-grade, multi-company attendance and workforce operations platform engineered with **React 19**, **React Native / Expo**, **Three.js / React Three Fiber**, and **Supabase (PostgreSQL 15 + RLS + Edge Functions)**.

Featuring a modern cyberpunk holographic aesthetic, biometric/hardware-bound QR kiosk verification, cryptographic WFH passcodes, automated absence detection, and complete role-based segregation of duties.

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Applications & Surfaces](#applications--surfaces)
   - [Web Application (`apps/web`)](#1-web-application-appsweb)
   - [Employee Mobile App (`apps/employee-mobile`)](#2-employee-mobile-app-appsemployee-mobile)
   - [Office QR Display Kiosk](#3-office-qr-display-kiosk)
3. [Backend & Security Architecture](#backend--security-architecture)
4. [3D Holographic Experience & Aesthetics](#3d-holographic-experience--aesthetics)
5. [Verified QA Demo Accounts](#verified-qa-demo-accounts)
6. [Local Development & Setup](#local-development--setup)
7. [Repository Structure](#repository-structure)

---

## System Architecture

```
+-----------------------------------------------------------------------------------------+
|                                    VorldX Ecosystem                                     |
|                                                                                         |
|   +-----------------------+   +-----------------------+   +-------------------------+   |
|   |    React 19 Web App   |   |   Expo Mobile App     |   |    Office QR Display    |   |
|   |  - Admin Dashboard    |   |  - GPS/QR Scanner     |   |  - 18s Dynamic QR Token |   |
|   |  - HR Operations      |   |  - WFH Passcode Punch |   |  - Hardware Device Key  |   |
|   |  - Policy & Kiosks    |   |  - Requests & History |   |  - Live Status Heartbeat|   |
|   +-----------+-----------+   +-----------+-----------+   +------------+------------+   |
|               |                           |                            |                |
|               +---------------------------+----------------------------+                |
|                                           | HTTPS / WSS                                 |
|                                           v                                             |
|   +---------------------------------------------------------------------------------+   |
|   |                        Supabase Cloud (ap-south-1)                              |   |
|   |                                                                                 |   |
|   |  +------------------------------+     +--------------------------------------+  |   |
|   |  |   14 Deno Edge Functions     |     |      PostgreSQL 15 Database          |  |   |
|   |  |  - issue-office-qr           |     |  - Strict Row Level Security (RLS)   |  |   |
|   |  |  - process-office-attendance |     |  - Multi-tenant Tenant Isolation     |  |   |
|   |  |  - generate-wfh-passcode     |     |  - pg_cron Auto-Absent Daemon        |  |   |
|   |  |  - mark-wfh-attendance       |     |  - Immutable Audit Trails            |  |   |
|   |  +------------------------------+     +--------------------------------------+  |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## Applications & Surfaces

### 1. Web Application (`apps/web`)
A responsive Single Page Application built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Framer Motion**.

- **Public & Authentication Portal** (`/`, `/login`, `/company/signup`, `/forgot-password`, `/reset-password`):
  - 3D realistic Earth globe with rotating network arcs and central energy core.
  - Multi-company registration creating initial Admin and tenant container.
  - Failure-safe user onboarding with automated email invitations and password recovery.
- **Admin Portal** (`/admin/*`):
  - **Live Analytics Dashboard**: Real-time headcount (18 employees across 5 departments), today presence telemetry (office vs WFH, on-time vs late), 30/90-day attendance trend bar charts, and pending request metrics.
  - **HR Management**: Onboard and manage HR Executives with departmental scopes.
  - **Attendance Audit & Override**: Correct missed punch records with mandatory audit justification notes.
  - **Company Policies**: Configure shift schedules, grace periods (minutes), working days, and WFH cutoff time limits.
  - **QR Kiosks**: Pair physical screens, generate SHA-256 hardware device keys, and inspect real-time connection heartbeats.
  - **Global Feedback**: View employee performance reviews, ratings, and historical notes.
- **HR Portal** (`/hr/*`):
  - **Operational Dashboard**: Department shift monitoring and quick oversight.
  - **Employee Directory**: Create, update, or deactivate employee profiles and assign shifts.
  - **Request Reviews**: Approve or reject employee WFH and Leave requests with audit notes.
  - **QR Attendance Station**: In-browser QR camera scanner for front-desk check-in/out.
  - **HR Self-Service**: Submit WFH and Leave requests directly to Admin (segregation of duties).
  - **Performance Feedback**: Submit formal 0–10 ratings and reviews for team members.

---

### 2. Employee Mobile App (`apps/employee-mobile`)
A companion mobile app built with **React Native**, **Expo SDK 52+**, **Expo Router**, and **@react-three/fiber/native**.

- **Typography & Theme**: Calibrated with `@expo-google-fonts/plus-jakarta-sans` and `@expo-google-fonts/space-mono`, matching the web design system.
- **Today Dashboard**: Real-time shift status card, hours worked counter, monthly attendance composition donut chart, and direct feedback actions.
- **QR Scanner (`/scan`)**: Hardware-accelerated camera scanner for scanning the office display to check in and check out.
- **WFH Passcode Check-In (`/wfh`)**: Dual-use passcode check-in/out for approved remote days.
- **Requests Hub (`/requests`)**: Submit WFH (enforced by the 120-minute pre-shift cutoff rule) and Leave requests; track approvals and active passcodes.
- **Attendance Calendar (`/attendance`)**: Monthly interactive calendar displaying on-time, late, WFH, absent, and leave badges.
- **Performance Reviews (`/feedback`)**: View reviews, criteria breakdown bars, and average scores from management.
- **Offline Reliability**: Powered by `@tanstack/react-query-persist-client` and AsyncStorage for instant launch and offline access.

---

### 3. Office QR Display Kiosk (`/display/:secret`)
A secure, full-screen office kiosk web application designed to run on lobby displays or tablets:
- Displays a dynamic, high-contrast QR code that regenerates every **18 seconds**.
- Tokens are salted with server timestamps and validated server-side.
- **Hardware-Bound Pairing**: The kiosk must present a persistent device key stored in local storage during pairing. A bare URL cannot be copied home to spoof attendance.

---

## Backend & Security Architecture

> [!TIP]
> **Dedicated Backend Documentation:**
> For the complete data model, interactive Mermaid ERD diagram, table schemas, and local CLI replication instructions, see the dedicated [**`supabase/README.md`**](supabase/README.md).

### Core Business Rules
- **Segregation of Duties**: HR approves Employee requests; Admin approves HR requests. Self-approval is strictly prevented by database triggers.
- **Mutual Exclusivity**: 1 check-in and 1 check-out per employee per day. An employee cannot punch both Office and WFH on the same day.
- **WFH Request Cutoff**: WFH requests must be submitted at least **120 minutes** before the shift start time, calculated in the company's designated timezone against trusted server time (`now()`).
- **Dynamic QR Validation**: Office QR tokens expire in 18 seconds. Expired tokens are rejected server-side (`QR_EXPIRED`).
- **Cryptographic WFH Passcodes**: Passcodes are hashed with SHA-256 in the database. Employees receive a 6-digit PIN with a maximum of 2 uses (check-in and check-out) that expires at shift end.
- **Automated Absence Engine (`011a_auto_absent.sql`)**: A scheduled background job (`pg_cron`) runs after shift end times to auto-mark employees as `absent` (`source = 'auto'`) if no check-in or approved leave was logged for that weekday.

### 15 Privileged Edge Functions
| Function | Purpose |
| :--- | :--- |
| `register-company` | Bootstraps company tenant, default shift, and first Admin user. |
| `create-hr` | Provisions HR Executive account and permissions. |
| `create-employee` | Creates employee account and profile. |
| `remove-employee` | Deactivates employee access and revokes active tokens. |
| `issue-office-qr` | Issues signed 18s QR tokens to verified, device-paired office kiosks. |
| `process-office-attendance` | Validates scanned QR token and records check-in/out. |
| `generate-wfh-passcode` | Generates a cryptographically hashed dual-use WFH passcode upon approval. |
| `mark-wfh-attendance` | Validates passcode and records remote check-in/out. |
| `submit-wfh-request` | Submits WFH request with 120-minute shift cutoff enforcement. |
| `review-wfh-request` | Approves or rejects WFH with notes and triggers passcode issuance. |
| `submit-leave-request` | Submits multi-day leave requests with business day validation. |
| `review-leave-request` | Approves or rejects leave requests. |
| `admin-correct-attendance` | Performs audited administrative attendance punch corrections. |
| `submit-feedback-review` | Records structured 0–10 employee performance reviews. |
| `_shared/guards.ts` | Security guards for role checking, timezone arithmetic, and error handling. |

---

## 3D Holographic Experience & Aesthetics

Both the Web portal and Mobile app feature a synchronized **3D Holographic Earth & Pedestal background**:

- **Real Earth Biome Simulation**:
  - **Glacial Polar Ice**: Frosted cyan-white (`#E0F2FE` / `#FFFFFF`) across Antarctica, Greenland, and the Arctic.
  - **Arid Deserts & Sand Dunes**: Warm amber-gold (`#F59E0B`) across the Sahara, Arabia, and the Australian Outback.
  - **Rainforests & Continents**: Rich emerald (`#10B981`) and vibrant green (`#22C55E`) over the Americas, Europe, Africa, India, and East Asia.
  - **Marine Coastal Waters**: Luminous cyan shelf glow (`#0284C7`) surrounding landmasses.
  - **Deep Space Oceans**: Midnight sapphire (`#081024` / `#050C1E`).
- **Interactive Network Arcs**: 3D curved Great Circle splines connecting major global cities (New York, London, Dubai, Mumbai, Singapore, Tokyo, Sydney, São Paulo) with traveling data packets.
- **Futuristic Double-Helix Pedestal**: Parametric Catmull-Rom tube geometries with carbon metallic skin (`#141727`) and glowing neon light veins cradling the globe.
- **Pulsing Energy Core**: Amber/gold glowing octahedron at the helix intersection with dynamic breathing glow.
- **Dual Tilted Orbitals**: Counter-rotating orbital rings with micro-satellite beacons.
- **Battery & Performance Optimization**:
  - Point count calibrated for 60 FPS mobile rendering (850 points on mobile, 2,600 on web).
  - Automatically pauses when backgrounded or minimized (`document.hidden` on Web, `AppState !== 'active'` on Mobile).
- **Dark Button Styling**: Action buttons use dark glassmorphic styling (`linear-gradient(180deg, #161a2e 0%, #0c0f1c 100%)`) with luminous borders to match the dark theme.

---

## Verified QA Demo Accounts

The database includes a pre-seeded QA Alpha company (`QA Alpha p5a-20261021a`) with 18 employees, 47 historical absences, live check-ins, approved WFH passcodes, and pending requests.

| Role | Email | Password | Primary Surface |
| :--- | :--- | :--- | :--- |
| **Admin** | `p5a-20261021a-a-admin@example.com` | `QaTest!2345` | Web: `http://localhost:5173/admin/dashboard` |
| **HR Executive** | `p5a-20261021a-a-hr@example.com` | `QaTest!2345` | Web: `http://localhost:5173/hr/dashboard` |
| **Employee** | `p5a-20261021a-a-emp@example.com` | `QaTest!2345` | Mobile App / Expo / Web |

> **Active WFH Passcode for Today:** The QA Employee account has an approved WFH pass for today. You can check in immediately using passcode: **`482915`**.

---

## Local Development & Setup

### Prerequisites
- **Node.js** 20.x or newer & **npm**
- **Supabase CLI** (optional, for local migration management)
- **Expo Go** or an Android/iOS emulator (for mobile testing)

### 1. Web Portal Setup
```bash
# Navigate to web app
cd apps/web

# Install dependencies
npm install

# Verify or create .env
cp .env.example .env

# Start development server
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### 2. Employee Mobile App Setup
```bash
# Navigate to mobile app
cd apps/employee-mobile

# Install dependencies
npm install

# Verify or create .env
cp .env.example .env

# Start Metro bundler
npx expo start
```
Scan the QR code with the **Expo Go** app on your phone, or press **`a`** for Android emulator / **`i`** for iOS simulator.

### 3. Testing & Builds
```bash
# Build web app bundle
cd apps/web && npm run build

# Typecheck mobile app
cd apps/employee-mobile && npx tsc --noEmit
```

---

## Repository Structure

```
VorldX-Attendance-System/
├── apps/
│   ├── web/                     # React 19 web application (Vite, Tailwind, R3F)
│   │   ├── src/
│   │   │   ├── components/      # 3D LandingScene, Shells, UI kits
│   │   │   ├── pages/           # Admin, HR, Auth, and Kiosk routes
│   │   │   ├── lib/             # Supabase client, auth contexts, utilities
│   │   │   └── index.css        # Design tokens and dark glassmorphic styles
│   │   └── package.json
│   └── employee-mobile/         # React Native mobile app (Expo Router, R3F Native)
│       ├── src/
│       │   ├── app/             # File-based routes ((app), (auth), tabs)
│       │   ├── components/      # 3D Orb, charts, forms, and UI primitives
│       │   ├── screens/         # Screen implementations (Dashboard, Scan, WFH, etc.)
│       │   └── constants/       # Theme tokens and typography
│       └── package.json
├── supabase/
│   ├── config.toml              # Supabase CLI local development configuration
│   ├── README.md                # Comprehensive backend ERD & security documentation
│   ├── functions/               # 15 Deno Edge Functions (business rules)
│   ├── migrations/              # 17 versioned PostgreSQL migrations & RLS policies
│   └── seed/
│       └── demo_full_qa_seed.sql # Comprehensive QA seed dataset
└── docs/
    ├── architecture.md          # Technical specifications and data model
    ├── demo-data.md             # Dataset verification logs and metrics guide
    ├── security-notes.md        # Cryptographic and anti-tampering documentation
    └── test-report.md           # Acceptance criteria verification reports
```

---

## License & Credits
Developed for **VorldX**. All rights reserved.
