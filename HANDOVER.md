# Parish Directory: Guide for Parish Staff

This guide is for whoever looks after the parish directory. You don't need any technical knowledge.

## Where everything lives

| What | Where |
|---|---|
| Registrations | The **"Parish Directory" Google Sheet** in the parish Google account |
| Household info | The **Households** tab: one row per family |
| Individual people | The **Members** tab: one row per person, with career, activities, and skills |
| Family photos | The **"Parish Directory Photos"** folder in Google Drive. Each household row links to its photo. |
| The form people fill out | The website address given to you at handover: `______________________` |

## Everyday tasks

**Finding volunteers with a skill** (for example, carpentry):
Open the **Members** tab and choose **Data → Filter views → Create new filter view**. Click the filter icon on *Services / Skills Offered*, then choose **Filter by condition → Text contains** and type `carpentry`. A filter view only changes what *you* see. Other staff aren't affected, and new registrations keep arriving normally. Close it with the **X** at the top right.

**Seeing everyone in one household:**
Copy the **Household ID** from the Households tab. On the Members tab, press Ctrl+F (⌘F on a Mac) and search for that ID.

**Correcting information:** Edit the cell directly in the Sheet. A warning appears saying the range "shouldn't be accidentally modified". Click **OK** if you meant to make the change. The warning is there to prevent slips.

**Golden rule for the Households and Members tabs:** new registrations are added at the bottom automatically, at any time. To avoid overwriting one:
- **Don't insert rows** or type anything below the last row.
- **Don't add or move columns.**
- Use **filter views** (above) to sort or filter, not the whole-sheet sort or filter.
- Need somewhere for your own notes or lists? Add a **new tab**. Don't use these two.

Editing a cell and deleting a family's rows (below) are both fine.

**Deleting a family (if they ask to be removed):**
1. Delete their row on the **Households** tab.
2. Delete their rows on the **Members** tab. They share the same Household ID.
3. Delete their photo from the Drive folder.

**Printing or sharing a directory:**
**File → Download → PDF or Excel.** Only include households that say **Yes** under *Directory Consent*. Only include photos where *Photo Consent* is **Yes**.

## Keeping the data private
- Share the Sheet and the photo folder **only with staff who need them**. Use Share → *Restricted*.
- Never make the photo folder "Anyone with the link".
- The form itself can only *add* entries. It can't read anything from the Sheet.

## Changing the ministries, skills, or parish name
These lists live in `web/src/fields.ts` in the code. Ask your volunteer web helper to edit that file. The site redeploys automatically when the change is saved to GitHub. It takes about 5 minutes.

## If something stops working
1. Open the Sheet → **Extensions → Apps Script → Executions** to see recent errors.
2. The most common cause is that the Google account that deployed the script lost access or was deleted. The script must stay owned by the **parish account**.
3. To redeploy: in Apps Script, choose **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The web address stays the same.

## Things that do NOT need maintenance
- No server to update or pay for.
- No passwords or keys to rotate.
- Hosting is free (Netlify free tier + Google Apps Script).
