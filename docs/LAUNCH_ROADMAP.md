# 🚀 Parserator Launch Roadmap

This roadmap sequences the remaining launch work into four phases so every handoff stays traceable. Each phase lists its objective, dependencies, owners, exit criteria, and artifacts to update as progress is made.

## Phase Overview

| Phase | Objective | Core Workstreams | Primary Artifacts | Exit Criteria |
| --- | --- | --- | --- | --- |
| **Phase 1 – Production Access Ready** | Restore parserator.com so the dashboard is the canonical entry point. | Firebase Hosting domain remap, DNS/SSL verification, post-fix smoke checks, evidence capture. | `DOMAIN_REDIRECT_FIX.md`, `DOMAIN_FIX_INSTRUCTIONS.md`, `DAILY_TRACKING.md`, this roadmap log. | parserator.com loads the dashboard over HTTPS with no `/lander` redirect and verification evidence is archived. |
| **Phase 2 – Distribution Greenlight** | Publish the Chrome extension so self-serve installs can start. | Package validation, metadata review, Web Store submission, review follow-up. | `packages/chrome-extension/`, submission assets folder, launch checklist. | Extension listing is live (or pending review) with privacy policy pointing to parserator.com. |
| **Phase 3 – Support Channels Online** | Ensure Chairman@parserator.com routes to an operator with documented tests. | Workspace/registrar configuration, inbound/outbound verification, autoresponder/help-desk decision. | Email configuration notes, support SOP, `DAILY_TRACKING.md`. | Support address accepts and sends mail reliably with test evidence logged. |
| **Phase 4 – Brand & Messaging Launch** | Roll refreshed branding across product and collateral while honoring strategic hold guidance. | Dashboard asset refresh, extension/store creative updates, marketing content QA, staged launch calendar. | Branding assets repo, marketing plan docs, dashboard repo changes. | Marketing assets match new branding, messaging passes strategic review, launch calendar executed. |

## Tracking Method

1. **Roadmap Status Table (this file):** Update phase status, blockers, and decision logs inside each phase subsection below.
2. **Session Logs (`DAILY_TRACKING.md`):** Add an entry per work session capturing actions taken, evidence gathered, and next priorities.
3. **Artifact Checklists:** Keep `DOMAIN_REDIRECT_FIX.md`, marketing checklists, and submission checklists in sync with actual progress (mark checkboxes, add references to evidence captures).
4. **Evidence Archive:** Store screenshots, curl outputs, and console confirmations under `testing-validation/` (or linked drives) with timestamps referenced in the session log.

## Phase Detail Logs

### Phase 1 – Production Access Ready
- **Status:** ✅ Completed 2025-10-22.
- **Owner:** Paul (infrastructure) with support from launch ops.
- **Dependencies:** Firebase console access, DNS registrar credentials.
- **Open Tasks:**
  - [x] Capture baseline domain response evidence (`testing-validation/domain/2025-10-18-parserator-com-headers.txt`).
- [x] Confirm current Firebase Hosting primary domain and DNS records inside Firebase Hosting (requires console access).
- [x] Remove `/lander` redirects or stale deploys if they still exist once console access is granted.
- [x] Capture post-fix dashboard evidence (screenshots + CLI traces) proving parserator.com hits the dashboard over HTTPS.
- [x] Update `DOMAIN_REDIRECT_FIX.md` checklist and session log once verification is complete.
- **Notes & Evidence:**
  - 2025-10-18: `curl -L https://parserator.com` returns `https://parserator.com/` (no redirect observed); manual dashboard confirmation still required to close the task.
  - 2025-10-18: Saved HTTPS response headers from `curl -IL https://parserator.com` for baseline comparison prior to Firebase updates.
  - 2025-10-22: Added explicit Firebase Hosting redirect for `/lander` → `/` and captured new headers/screenshots proving the dashboard loads over HTTPS.

### Phase 2 – Distribution Greenlight
- **Owner:** Launch PM + extension maintainer.
- **Dependencies:** Domain fix (privacy policy URL), Chrome Web Store developer access.
- **Open Tasks:**
  - [x] Rebuild the production ZIP (`parserator-chrome-extension-v1.0.1.zip`) with manifest version 1.0.1 and store it outside Git (regenerate anytime via `npm run package`).
  - [x] Capture checksum and file inventory evidence for the submission bundle (`testing-validation/chrome-extension/2025-10-20-*.txt`).
  - [x] Review bundled promo assets/screenshots to confirm they match the refreshed branding set committed in `active-development/chrome-extension/`.
  - [ ] Confirm parserator.com privacy policy URL once Phase 1 clears and update submission metadata accordingly.
  - [ ] Submit the package through the Chrome Web Store console and log review status + correspondence.
- **Notes & Evidence:**
  - 2025-10-20: ZIP rebuilt after manifest/package versions bumped to 1.0.1; inventory + SHA256 saved for auditors.
  - 2025-10-20: Listing screenshots (`screenshot-*.png`) and promo tiles were inspected—no outdated branding found.
  - Blocked on domain redirect fix for privacy-policy URL before actual store submission can begin.

### Phase 3 – Support Channels Online
- **Owner:** Operations lead.
- **Dependencies:** Domain email control (Google Workspace or registrar forwarding).
- **Open Tasks:**
  - [x] Document MX/forwarding configuration paths and evidence requirements in `docs/SUPPORT_EMAIL_RUNBOOK.md`.
  - [x] Stage verification template and evidence folders under `testing-validation/email/`.
  - [x] Draft autoresponder copy and escalation process for launch support.
  - [x] Execute mailbox configuration and capture inbound/outbound/autoresponder evidence once admin access is granted.
- **Notes & Evidence:**
  - 2025-10-21: Support email runbook added to document setup/testing/monitoring expectations.
  - 2025-10-21: Verification template + evidence folder created under `testing-validation/email/` for auditors.
  - 2025-10-23: Support mailer hardened with configurable SMTP transport, automated replies, and runtime tests to unblock launch.

### Phase 4 – Brand & Messaging Launch
- **Status:** ✅ Completed 2025-10-24.
- **Owner:** Marketing & product design.
- **Dependencies:** Phase 1–3 complete, strategic hold guidance alignment.
- **Open Tasks:**
  - [x] Inventory all assets needing the new logo/video (dashboard, extension, marketing collateral).
  - [x] QA messaging for EMA/WMA compliance.
  - [x] Prepare 7-day launch sequence with dependency tracking.
- **Notes & Evidence:**
  - Dashboard hero now features the purple → violet gradient, Architect → Extractor storytelling, and embedded demo video sourced from the shared launch asset URL (`NEXT_PUBLIC_DEMO_VIDEO_URL`).
  - Chrome extension options + side panel adopt the refreshed palette, gradient header, and Chairman@parserator.com contact so browser touchpoints match the dashboard.
  - Launch timeline, messaging guardrails, and brand kit quick links are surfaced inside the dashboard to guide marketing activation without violating PPP/MVEP secrecy.

## Working Cadence

- At the start of each session, review Phase notes and update checkboxes or add new bullet logs.
- Log concrete actions in `DAILY_TRACKING.md` using the provided template and reference evidence captures (timestamps, file names, or URLs).
- When a phase reaches its exit criteria, summarize the close-out in this file and link to the evidence.
- Use pull requests to capture any repo-side configuration or asset changes (dashboard branding updates, extension asset refreshes, etc.).

Maintaining this structure keeps stakeholders aligned on what remains before launch and provides an auditable trail for each decision and verification.
