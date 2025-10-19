# 📬 Support Email Runbook

Parserator customer support relies on `Chairman@parserator.com` to route inbound requests to the launch team while preserving documented response times and EMA transparency. This runbook captures the full setup, testing, and monitoring flow so the mailbox is production-ready before marketing pushes begin.

---

## 1. Prerequisites

| Requirement | Owner | Notes |
| --- | --- | --- |
| Google Workspace admin access for `parserator.com` | Ops lead | Needed to manage users, routing, and security. |
| DNS registrar access (Namecheap/Google Domains/etc.) | Ops lead | Required for MX/DKIM/SPF configuration if not already present. |
| Support destination mailbox (e.g., `support@parserator.com` Google Group or shared inbox) | Support manager | Ensure at least two humans monitor the inbox to satisfy EMA responsiveness. |
| Launch evidence folder (`testing-validation/email/`) | Documentation lead | Store screenshots, headers, and SMTP traces for audits. |

---

## 2. Configuration Paths

### Option A – Google Workspace Shared Mailbox (recommended)
1. **Create support mailbox**: Admin Console → Directory → Users → *Add new user* `Chairman@parserator.com`.
2. **Assign license**: Business Starter or above so the mailbox can send mail.
3. **Delegate access**: Admin Console → Apps → Google Workspace → Gmail → *User settings* → `Chairman@parserator.com` → *Add delegated users* (launch support roster).
4. **Set sending alias**: Gmail settings for each delegate → Accounts → "Send mail as" → add `Chairman@parserator.com` (use Gmail SMTP with OAuth by default).
5. **Configure routing** *(optional fallback)*: Admin Console → Apps → Google Workspace → Gmail → Routing → Add rule "Support mirroring" to forward to backup addresses (e.g., founder personal inbox).

### Option B – Registrar Forwarding (interim)
1. **Create alias**: Registrar dashboard → Email forwarding → Add `Chairman@parserator.com` → forward to `parserator+support@gmail.com`.
2. **Set reply-from address**: In Gmail receiving account → Settings → Accounts → "Send mail as" → `Chairman@parserator.com` using SMTP credentials supplied by registrar.
3. **Document limitations**: Note lack of shared visibility and potential SPF/DKIM failures; treat as temporary until Workspace access is restored.

### Cloud Functions configuration
- Set Firebase Functions config or environment variables for the support mailer before deploying:
  - `support.email`, `support.sender_name`, `support.reply_to`
  - `support.transport.host`, `support.transport.port`, `support.transport.secure`
  - `support.transport.user`, `support.transport.pass` *(or OAuth tokens if preferred)*
  - `support.mailbox_endpoint` → defaults to the deployed `emailToSchema` HTTPS function
  - `gemini.api_key` for schema analysis
- Local development can use `SUPPORT_STREAM_TRANSPORT=true` to keep messages in-memory while verifying webhooks.

---

## 3. DNS Records Checklist

| Record | Purpose | Target | How to verify |
| --- | --- | --- | --- |
| MX | Route inbound mail | `ASPMX.L.GOOGLE.COM` (plus backups) | `dig MX parserator.com` and confirm Google Workspace priorities. |
| SPF | Authorize senders | `v=spf1 include:_spf.google.com ~all` | `dig TXT parserator.com | grep spf` and validate with https://www.kitterman.com/spf/validate.html. |
| DKIM | Prevent spoofing | Google Admin → Apps → Gmail → Authenticate email → publish TXT `google._domainkey.parserator.com` | Run `dig TXT google._domainkey.parserator.com`. |
| DMARC | Monitor spoofing | `_dmarc.parserator.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@parserator.com"` | `dig TXT _dmarc.parserator.com`. |

> ✅ **Archive** CLI output from each verification in `testing-validation/email/<date>-dns-verification.txt`.

---

## 4. Mail Flow Testing

Perform these tests after MX propagation (can take up to 1 hour). Record results in `testing-validation/email/`.

| Test | Procedure | Evidence |
| --- | --- | --- |
| **Inbound (external → Chairman@)** | Send email from non-Parserator address with subject `Inbound Test YYYY-MM-DD`. Confirm arrival in shared inbox & backup forward. | Save screenshot of received email + raw headers to `.../inbound/`. |
| **Outbound (Chairman@ → external)** | Reply to inbound test using `Chairman@parserator.com`. Confirm SPF/DKIM pass on recipient headers. | Save raw headers to `.../outbound/`. |
| **Autoresponder** | Enable Gmail vacation responder or Workspace template. Trigger with inbound test, ensure autoresponse references SLA. | Screenshot autoresponder + copy text in repo. |
| **Ticket Handoff** | Create Triage note in support tracker (Notion/Jira). Ensure metadata includes `Support Channel: Email`. | Export PDF or screenshot of ticket entry. |

Include timestamps, testers, and Gmail message IDs in each log entry.

---

## 5. Autoresponder Template

```
Subject: We received your Parserator request

Hey there — thanks for reaching out to Parserator support!

We’ve logged your message and a human teammate will respond within one business day.

In the meantime you can:
• Visit the dashboard help center → https://parserator.com/help
• Review SDK docs → https://parserator.com/docs/sdk
• Join the developer Discord → https://discord.gg/parserator

If this is urgent, reply with URGENT in the subject line and we’ll escalate immediately.

— The Parserator Team
EMA · Data liberation for the AI age
```

Store this text in Gmail → Settings → See all settings → General → Vacation responder. Set "Ends" to *No end date* until full help-desk automation launches.

---

## 6. Monitoring & Escalation

1. **Daily checks**: Delegates confirm inbox zero at standup; log summary in `DAILY_TRACKING.md` when notable issues arise.
2. **SLA tracking**: Record response times in support tracker; escalate anything >24h to ops lead via Slack `#launch-support` channel.
3. **Alerting**: Enable Gmail forwarding of undelivered bounce notifications to `ops@parserator.com`.
4. **Security**: Turn on 2FA for delegates; review login alerts weekly.

If repeated delivery failures occur, run `gsutil` script in `active-development/packages/email-parser/` to check parsing pipeline and update this runbook with remediation steps.

---

## 7. Close-out Checklist

- [ ] MX/SPF/DKIM/DMARC records verified and archived.
- [ ] Inbound/outbound/autoresponder/ticket tests captured with evidence filenames.
- [ ] Autoresponder enabled with approved copy.
- [ ] Support roster and escalation matrix stored in ops handbook.
- [ ] `docs/LAUNCH_ROADMAP.md` Phase 3 section updated with verification summary.

Once all boxes are checked and evidence committed, Phase 3 exit criteria are satisfied.

---

## 8. Evidence Index Template

Add a Markdown file per verification run: `testing-validation/email/YYYY-MM-DD-support-channel-verification.md` with the structure below.

```
# Parserator Support Channel Verification – YYYY-MM-DD

## Participants
- Tester: <name>
- Reviewer: <name>

## DNS Checks
- MX: [link to CLI output]
- SPF: [link to CLI output]
- DKIM: [link]
- DMARC: [link]

## Test Runs
| Test | Status | Evidence |
| --- | --- | --- |
| Inbound | ✅ | <file> |
| Outbound | ✅ | <file> |
| Autoresponder | ✅ | <file> |
| Ticket Handoff | ✅ | <file> |

## Notes
- Observations, anomalies, follow-up actions.
```

This ensures auditors can trace every verification step back to stored artifacts.
