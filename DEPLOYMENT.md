# Deployment & Test Plan

How to take the Parish Directory from this repo to a live form, in two passes:

| Environment | Google account | Sheet | Frontend | Purpose |
|---|---|---|---|---|
| **TEST** | Your own Google account | `Parish Directory (TEST)` | `localhost` → your Netlify site | Prove everything works; safe to break |
| **PROD** | The **parish's** Google account | `Parish Directory` | Client's Netlify site (+ optional custom domain) | The real thing |

The two environments never share a Sheet, script, or `/exec` URL. Any later change goes through TEST first, then PROD.

---

## Phase 0: Prerequisites (once)

- [ ] Node **20.19+ or 22.12+** (Vite 8 needs this). Check with `node --version`.
- [ ] A GitHub account and a Netlify account.
- [ ] A Google account for TEST. A personal Gmail is fine.
- [ ] Commit the repo. It has no commits yet:
  ```bash
  cd parish-directory
  git add .gitignore README.md HANDOVER.md DEPLOYMENT.md netlify.toml apps-script web
  git commit -m "Initial parish directory form"
  ```
  `web/dist`, `node_modules`, and `.env` are already git-ignored. Decide whether `.claude/` belongs in the repo.
- [ ] Push to a **private** GitHub repo.

---

## Phase 1: Local smoke test (no backend)

```bash
cd web
npm install
npm run build      # must pass: type-check + bundle
npm run dev        # http://localhost:5173
```

- [ ] The form renders and looks right on desktop and in DevTools mobile view (375px).
- [ ] Clicking **Submit** on an empty form shows inline errors and scrolls to the first one.
- [ ] Filling in valid data and submitting shows *"This form is not connected yet…"*. This is expected because there's no `.env` yet.

---

## Phase 2: TEST backend (your Google account)

### 2.1 Create the Sheet and script
1. In **your** Google account, create a Sheet named `Parish Directory (TEST)`.
2. **Extensions → Apps Script.** Rename the project `Parish Directory (TEST)`.
3. Replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs).
4. Open **Project Settings** (gear icon) and tick **Show "appsscript.json" manifest file in editor**. Back in the Editor, replace `appsscript.json` with [`apps-script/appsscript.json`](apps-script/appsscript.json). Set `timeZone` (e.g. `America/New_York`). Save.

### 2.2 Run `setup` and authorize
1. Choose `setup` in the function dropdown, then click **Run**.
2. You'll see the warning *"Google hasn't verified this app"*. Click **Advanced → Go to Parish Directory (TEST) (unsafe)**. This is normal for a private script.
3. On the consent screen, **tick every permission** (or "Select all"). If one is left unticked, the script fails later.
4. Check:
   - [ ] The execution log shows `Setup complete. Photo folder: https://drive.google.com/...`
   - [ ] The Sheet has a **Households** tab and a **Members** tab, each with a bold, frozen header row.
   - [ ] Drive has a `Parish Directory Photos` folder, and it's private.

> ⚠️ **If `setup` fails** with *"You do not have permission to call DriveApp… Required permissions: …/auth/drive"*, Apps Script didn't accept the narrow `drive.file` scope for `DriveApp`. In `appsscript.json`, change `https://www.googleapis.com/auth/drive.file` to `https://www.googleapis.com/auth/drive`. Re-run `setup` and re-authorize, then update the scope note in README. Record what happened, because PROD will behave the same way.

### 2.3 Deploy as a web app
1. **Deploy → New deployment → ⚙ → Web app.**
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (*not* "Anyone with Google account")
2. Copy the **Web app URL**. It ends in `/exec`. Save it as your `TEST_EXEC_URL`.

### 2.4 Test the backend directly with curl
```bash
export TEST_EXEC_URL="https://script.google.com/macros/s/XXXX/exec"

# Health check → {"ok":true,"message":"Parish Directory endpoint is running."}
curl -sL "$TEST_EXEC_URL"
```

Save this as `/tmp/payload.json`:
```json
{
  "householdName": "Curl Test Family",
  "firstName": "Curl", "lastName": "Tester",
  "email": "curl@example.com", "phone": "555-0100",
  "address": { "street": "1 Main St", "city": "Boston", "state": "MA", "zip": "02134" },
  "contactMethod": "Email",
  "members": [
    { "firstName": "Curl", "lastName": "Tester", "relationship": "Self", "occupation": "Tester",
      "activities": ["Lector"], "activitiesOther": "", "skills": ["IT / Computers"], "skillsOther": "" }
  ],
  "photo": null, "consentDirectory": true, "consentPhoto": false, "website": ""
}
```

```bash
# Valid submission → {"ok":true,"householdId":"H-2026…"}
curl -sL -H 'Content-Type: text/plain' --data @/tmp/payload.json "$TEST_EXEC_URL"
```
> Use `--data` with `-L`. **Don't** add `-X POST`. Apps Script answers with a 302 redirect that must be followed with a GET. `-X POST` breaks that.

| # | Test | How | Expected |
|---|---|---|---|
| B1 | Valid POST | command above | `ok:true`. 1 Households row and 1 Members row with the same Household ID |
| B2 | Validation | change `email` to `"nope"` and `consentDirectory` to `false` | `ok:false` with both error messages. No rows added |
| B3 | Honeypot | set `"website": "spam"` | `ok:true` but **no** rows added |
| B4 | Bad JSON | `curl -sL --data 'garbage' "$TEST_EXEC_URL"` | `{"ok":false,"error":"Invalid request."}` |
| B5 | Leading zeros | check the B1 row | ZIP shows **02134**, not 2134 (see Known issues #1) |
| B6 | Concurrent load | see below | No lost, duplicated, or overwritten rows |

Check **Extensions → Apps Script → Executions**: each call should appear, with no failed runs except the ones you expected.

#### B6: Concurrent load test
This test checks that simultaneous submissions don't overwrite each other's member rows. Make a copy of the payload with **3 members**: duplicate the object in `members` twice and change the first names. Save it as `/tmp/payload3.json`. Then send 15 submissions at once:

```bash
seq 1 15 | xargs -P 15 -I{} sh -c \
  'sed "s/Curl Test Family/Load {}/" /tmp/payload3.json | curl -sL -H "Content-Type: text/plain" --data @- "$TEST_EXEC_URL"; echo'
```

- [ ] All 15 responses are `ok:true`. A few `"The server is busy"` responses are acceptable only if the matching rows are absent.
- [ ] **Households** has 15 new `Load N` rows, and **Members** has 45 new rows.
- [ ] In a spare cell, `=QUERY(Members!B2:B, "select B, count(B) where B <> '' group by B")` shows every new Household ID exactly **3** times.
- [ ] Each household's 3 member rows carry their own household's name in column C. Nothing is mismatched.

Run it **3 times**. Race conditions depend on timing, so one clean run doesn't prove much. Delete the `Load N` rows afterwards.

---

## Phase 3: TEST frontend locally, against the TEST backend

```bash
cd web
cp .env.example .env
# edit .env → VITE_APPS_SCRIPT_URL=<TEST_EXEC_URL>
npm run dev
```
Restart `npm run dev` after any `.env` change. Vite reads it at startup.

### Functional test matrix

Run every test, tick the result, and check the Sheet and Drive after each submission.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| F1 | Minimal happy path | Required fields only, no extra members, no photo | "Thank you!" screen. 1 household row, 1 member row (relationship `Self`) |
| F2 | Full household | Primary + 3 members, with activities, skills, and "Other" text. Leave one member's last name blank | 4 member rows. Blank last name is filled from the primary contact. "Other" text is appended to the list |
| F3 | Large phone photo | Upload a 5–12 MB camera JPG | Preview appears. Drive file is ~200–400 KB and ≤1200px. **Photo Link** opens it (while signed in) |
| F4 | Transparent PNG | Upload a PNG with transparency | Saved as JPG on a white background |
| F5 | iPhone HEIC | On an iPhone, take or choose a photo in Safari | Works, or shows the friendly "couldn't read that photo" error. Never a broken submit |
| F6 | Photo consent | Add a photo, leave photo consent unticked, submit | Blocked with "Please confirm, or remove the photo." |
| F7 | Remove photo | Add a photo, then **Remove photo** | Photo consent box disappears. Submission has empty Photo Link and Photo Consent |
| F8 | Conditional contact | Contact = Phone with no phone; Contact = Mail with no street/city | Inline error in each case |
| F9 | Member without name | Add a member, leave first name empty | Blocked with an error on that member card |
| F10 | Member cap | Add members until the button disappears | Max 20 total |
| F11 | Formula injection | Household name `=HYPERLINK("http://x.com","click")`, occupation `+44 test`, other skill `@admin` | Cells show the literal text. Nothing turns into a formula or link |
| F12 | Leading zeros | ZIP `02134`, phone `0412 345 678` | Stored exactly as typed (see Known issues #1) |
| F13 | Unicode | Names like `José Nguyễn`, `O'Brien`, emoji in occupation | Stored correctly. Photo filename has odd characters stripped |
| F14 | Autofill | Fill the contact section with Chrome/Safari autofill or a password manager, then submit | Row **does** appear. If it doesn't, autofill filled the hidden honeypot (see Known issues #4) |
| F15 | Offline | DevTools → Network → Offline → Submit | "Could not reach the server…" message. Form data kept |
| F16 | Double-click | Click Submit twice quickly | Exactly one household recorded |
| F17 | Concurrent (UI) | Two browser windows, submit both within ~1 s, each with 2+ members | Both households saved. Member rows not interleaved or overwritten. B6 is the real stress test; this checks the UI path |
| F18 | Reset | After success, click **Submit another household** | Blank form, no stale errors or photo |

### Non-functional checks
- [ ] Keyboard only: you can tab through every field, tick checkboxes with Space, and submit with Enter.
- [ ] The hidden "Website" field is **not** reachable by Tab.
- [ ] Mobile (real phone): fields aren't cut off, and the keyboard doesn't cover inputs badly. Submitting with a photo over cellular takes a few seconds at most.
- [ ] Submission time is acceptable. Apps Script normally takes 2–6 s, and photos add a bit.

---

## Phase 4: TEST frontend on Netlify (your account)

1. Netlify → **Add new site → Import an existing project → GitHub** → pick the repo. `netlify.toml` sets base `web`, command `npm run build`, and publish `dist`.
2. **Before the first build**, go to **Site configuration → Environment variables** and add:
   - `VITE_APPS_SCRIPT_URL` = `TEST_EXEC_URL`
   - `NODE_VERSION` = `22` (unless it's pinned in `netlify.toml`; see Known issues #3)
3. Deploy. If you add or change the env var later, use **Deploys → Trigger deploy → Clear cache and deploy site**. `VITE_*` values are baked in at build time.
4. Check:
   - [ ] The build log shows Node 22 and `✓ built`.
   - [ ] The live URL loads over HTTPS.
   - [ ] Re-run **F1, F3, F5, F14, F17** from a real phone on the Netlify URL.
   - [ ] `curl -s https://<site>.netlify.app | grep noindex` shows the robots tag, so search engines won't index the form.

**TEST is done when every row in Phase 2–4 passes.** Clear the TEST Sheet rows and photos if you want a clean demo for the client.

---

## Phase 5: PROD (client's system)

### 5.1 Pre-flight with the client
Settle these **before** touching their account:

- [ ] **Which Google account owns it?** It must be a **parish-owned** account (e.g. `office@parish.org`), not a staff member's personal Gmail. Whoever deploys the script is who it "executes as", forever.
- [ ] **Is it Google Workspace** (e.g. Workspace for Nonprofits)? If so, the Workspace admin may block "Who has access: **Anyone**" for web apps. Check **Admin console → Apps → Google Workspace → Drive and Docs → Sharing settings**. External sharing must be allowed for the deploy dialog to offer "Anyone". If only "Anyone within *domain*" is offered, the public form **cannot** submit.
- [ ] **Parish content** for [`web/src/fields.ts`](web/src/fields.ts): parish name, intro text, privacy note, ministries list, skills list. Get written sign-off, especially on the privacy note.
- [ ] **Time zone** for `appsscript.json`.
- [ ] **Hosting owner:** a Netlify account under the parish email (recommended for handover), or your agency account. Also decide whether to use a custom domain (e.g. `directory.parish.org`), and who controls the DNS.
- [ ] **Who gets access** to the Sheet and photo folder (named staff only).

### 5.2 Configure and test the content
1. Update `fields.ts` and commit.
2. Re-run **Phase 3** quickly against **TEST** to confirm the new lists render and save.

### 5.3 Build the PROD backend (in the parish account)
Do this **signed in as the parish account**. Have the client drive on a screen share, or use credentials they give you temporarily. Don't build it in your account and transfer it.

1. Repeat **2.1 → 2.3** exactly, with the Sheet named `Parish Directory`.
2. If you hit the `drive.file` → `drive` scope issue in TEST, use the same fix here.
3. Save the `/exec` URL as `PROD_EXEC_URL`, and store it somewhere the client can find it.
4. Run **B1** (curl health check plus one valid POST). Then **delete** that test row, its member rows, and anything in the photo folder.

### 5.4 Deploy the PROD frontend
1. Create the PROD Netlify site from the same GitHub repo (in the parish's or your Netlify account).
2. Set env vars: `VITE_APPS_SCRIPT_URL` = `PROD_EXEC_URL` and `NODE_VERSION` = `22`. Deploy.
3. Optional custom domain: **Domain management → Add domain**, add the CNAME at the client's DNS, and wait for HTTPS to provision.
4. Point your TEST Netlify site at a separate branch (e.g. `staging`), or turn off its auto-deploy, so TEST and PROD don't both build from `main` with different backends by accident.

### 5.5 Production smoke test
- [ ] From a phone, submit one household named **`TEST – please delete`** with a photo.
- [ ] Confirm the household row, member rows, Drive photo, and that the Photo Link opens.
- [ ] Delete all three (household row, member rows, photo).
- [ ] Check **Executions** in Apps Script: no errors.

### 5.6 Lock down and hand over
- [ ] Sheet → **Share → General access: Restricted**. Add only named staff.
- [ ] Photo folder: **Restricted**. Never "Anyone with the link".
- [ ] Protect the raw tabs against accidental edits while submissions are arriving. For **Households** and **Members**: right-click the tab → **Protect sheet** → **Set permissions** → **Show a warning when editing this range** → Done. This warns staff without blocking them. The script isn't affected. Walk staff through the "golden rule" in HANDOVER.md.
- [ ] Remove your own access to the parish account and Sheet when appropriate. Make sure the client changes any password they shared with you.
- [ ] Fill in the form URL blank in [HANDOVER.md](HANDOVER.md). Give the client HANDOVER.md, the form URL, and `PROD_EXEC_URL`.

---

## Phase 6: Updating and rolling back

**Frontend change** (copy, lists, styling):
1. Change, then `npm run build` locally.
2. Deploy to TEST and run the relevant tests.
3. Merge to the PROD branch. Netlify rebuilds automatically.
4. **Rollback:** Netlify → Deploys → pick the last good deploy → **Publish deploy**.

**Backend change** (`Code.gs` or the manifest):
1. Paste the new code into the **TEST** script. **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy.** Re-run Phase 2.4 and the affected F-tests.
2. Repeat in the **PROD** script.
3. Always use **Manage deployments → New version**. **Never "New deployment"**: that creates a *new* `/exec` URL and the live form keeps posting to the old one.
4. If you changed `oauthScopes`, run `setup` once in the editor to re-authorize *before* deploying the new version.
5. **Rollback:** Manage deployments → ✎ Edit → choose the previous version → Deploy.

Saving code in the editor does **not** change the live `/exec` behavior. Only a new deployment version does.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "This form is not connected yet" on the live site | `VITE_APPS_SCRIPT_URL` missing at build time | Set the env var, then **Clear cache and deploy** |
| "Something went wrong. Please try again." with no row added | Response wasn't JSON. Usually access isn't "Anyone", or the script needs re-authorization | `curl -sL "$EXEC_URL"`. If it returns a Google sign-in HTML page, fix access in Manage deployments. Re-run `setup` to re-authorize |
| "Something went wrong saving your information" | Script threw inside `doPost` | Apps Script → **Executions** → open the failed run |
| `FOLDER_ID not set — run setup() first` | `setup` never ran in this script | Run `setup` |
| Code change has no effect | Saved but not redeployed | Manage deployments → New version |
| Netlify build fails on `vite` | Node too old | `NODE_VERSION=22` |
| Submissions vanish with no error | Honeypot tripped (autofill), or the form points at TEST instead of PROD | Check the env var. Check F14 |

---

## Known issues found in code review (resolve or accept before PROD)

1. **ZIP codes and phone numbers may lose leading zeros.** `appendRow` lets Sheets auto-parse values, so `02134` can become `2134` ([Code.gs:83-91](apps-script/Code.gs#L83-L91)). Tests B5 and F12 confirm it. Fix: format the Phone and ZIP columns as plain text in `ensureSheet_`, or prefix those values with `'`.
2. **Workspace accounts may not allow "Anyone" web apps.** This is a client-side admin setting (see 5.1). It's the biggest risk to PROD.
3. **Node version isn't pinned for Netlify.** Vite 8 needs Node ≥ 20.19 / 22.12. Add `[build.environment] NODE_VERSION = "22"` to `netlify.toml`, or set it in the Netlify UI.
4. **The honeypot fails silently.** If a browser autofills the hidden `website` field, the user sees "Thank you!" but nothing is saved. Low likelihood. F14 covers it.
5. **`drive.file` scope with `DriveApp`.** This is the narrowest scope, but confirm `setup` works with it (2.2). Fall back to `drive` if it doesn't.
6. **The server doesn't enforce the Phone/Mail conditional rules.** Only the browser does. This is harmless, just inconsistent.
7. **Orphan photos.** The photo is saved *before* the Sheet lock, so slow Drive uploads don't hold up other submissions. If the Sheet write then fails or the server is busy, the photo stays in Drive without a row. This is rare, and you can clean it up by hand. Match the Household ID in the filename against the Households tab.
8. **The endpoint is public by design.** Anyone who reads the JS bundle can POST to `/exec`. There's no rate limiting beyond the honeypot. That's acceptable at parish scale. Watch for spam rows.
