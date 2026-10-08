# Parish Directory

A lightweight registration form for a parish directory. Parishioners fill out a web form. Each submission lands in the parish's **Google Sheet**, and family photos are saved to a private **Google Drive folder**.

```
React form (Netlify, free)  ──POST──▶  Google Apps Script web app  ──▶  Google Sheet (Households + Members tabs)
                                                                   └─▶  Drive folder "Parish Directory Photos"
```

- **No server, no API keys.** The Apps Script runs as the parish's Google account.
- **The parish owns everything:** the Sheet, the Drive folder, and the script.
- Non-technical upkeep is covered in **[HANDOVER.md](HANDOVER.md)**.

## Repo layout

| Path | What it is |
|---|---|
| `web/` | Vite + React + TypeScript form |
| `web/src/fields.ts` | **Parish-editable settings**: parish name, ministries list, skills list, privacy text |
| `apps-script/Code.gs` | Backend: validation, honeypot, photo save, row append |
| `apps-script/appsscript.json` | Apps Script manifest (web app + minimal OAuth scopes) |
| `netlify.toml` | Netlify build config (builds `web/`) |

## Local development

```bash
cd web
cp .env.example .env        # paste your Apps Script /exec URL
npm install
npm run dev
```

## Deploy

### 1. Backend (Google Apps Script)
1. Sign in to the **parish's** Google account (not a personal one) and create a new Google Sheet, e.g. "Parish Directory".
2. **Extensions → Apps Script.** Replace `Code.gs` with `apps-script/Code.gs`.
3. **Project Settings → Show "appsscript.json"**, then paste in `apps-script/appsscript.json`. Set `timeZone` to the parish's time zone.
4. Pick `setup` in the function dropdown, click **Run**, and approve the permissions. This creates the `Households` and `Members` tabs and the private `Parish Directory Photos` folder.
5. **Deploy → New deployment → Web app.** Set *Execute as: Me* and *Who has access: Anyone*. Copy the `/exec` URL.

(Optional: use [`clasp`](https://github.com/google/clasp) to push `apps-script/` from the command line.)

### 2. Frontend (Netlify)
1. Push this repo to GitHub, then in Netlify choose **Add new site → Import from Git**. `netlify.toml` configures the build.
2. **Site settings → Environment variables**: set `VITE_APPS_SCRIPT_URL` to the `/exec` URL, then redeploy.

Any static host works (GitHub Pages, Cloudflare Pages, Vercel). Run `npm run build` in `web/` and upload `web/dist`.

## Data model

**Households** tab: one row per submission.
Submitted At, Household ID, Household Name, contact name/email/phone, address, Preferred Contact, Member Count, Photo Link, Directory Consent, Photo Consent.

**Members** tab: one row per person, linked to a household by Household ID.
First/Last Name, Relationship, Career / Occupation, Church Activities, Services / Skills Offered.

## Safeguards
- A hidden honeypot field drops bot submissions.
- The server checks required fields, text length, member count, photo type (JPG/PNG), and photo size (~5 MB).
- Values that begin with `= + - @` are escaped, so they can't run as spreadsheet formulas.
- The browser shrinks photos to 1200px JPEG (~200–400 KB) before upload.
- `LockService` serializes writes, so simultaneous submissions don't collide.
- OAuth scopes are limited to *this spreadsheet* and *files the script created* (`drive.file`).
