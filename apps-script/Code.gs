/**
 * Parish Directory — Google Apps Script backend.
 *
 * This script is bound to the parish's Google Sheet (Extensions → Apps Script).
 * It receives form submissions from the web form, saves the family photo to a
 * private Drive folder, and appends rows to the "Households" and "Members" tabs.
 *
 * First-time setup: run `setup` once from the Apps Script editor, then deploy
 * as a Web app (Execute as: Me, Who has access: Anyone). See HANDOVER.md.
 */

const HOUSEHOLDS_SHEET = 'Households';
const MEMBERS_SHEET = 'Members';
const PHOTO_FOLDER_NAME = 'Parish Directory Photos';

const HOUSEHOLD_HEADERS = [
  'Submitted At', 'Household ID', 'Household Name',
  'Contact First Name', 'Contact Last Name', 'Email', 'Phone',
  'Street', 'City', 'State', 'ZIP', 'Preferred Contact',
  'Member Count', 'Photo Link', 'Directory Consent', 'Photo Consent',
];

const MEMBER_HEADERS = [
  'Submitted At', 'Household ID', 'Household Name',
  'First Name', 'Last Name', 'Relationship', 'Career / Occupation',
  'Church Activities', 'Services / Skills Offered',
];

const MAX_TEXT = 500;
const MAX_MEMBERS = 20;
const MAX_LIST_ITEMS = 40;
const MAX_PHOTO_BASE64 = 7 * 1024 * 1024; // ~5 MB decoded
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];

/** Run once from the editor: creates tabs, headers, and the private photo folder. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, HOUSEHOLDS_SHEET, HOUSEHOLD_HEADERS);
  ensureSheet_(ss, MEMBERS_SHEET, MEMBER_HEADERS);

  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('FOLDER_ID');
  if (!folderId || !folderExists_(folderId)) {
    const folder = DriveApp.createFolder(PHOTO_FOLDER_NAME);
    folderId = folder.getId();
    props.setProperty('FOLDER_ID', folderId);
  }
  Logger.log('Setup complete. Photo folder: https://drive.google.com/drive/folders/' + folderId);
}

function doGet() {
  return json_({ ok: true, message: 'Parish Directory endpoint is running.' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request.' });
  }

  // Honeypot: real people never fill this hidden field. Pretend success for bots.
  if (data.website) return json_({ ok: true });

  const errors = validate_(data);
  if (errors.length) return json_({ ok: false, error: errors.join(' ') });

  try {
    // Everything up to the lock touches nothing shared: the ID and photo filename are unique.
    const now = new Date();
    const householdId = 'H-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd') +
      '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
    const householdName = clean_(data.householdName);
    const address = data.address || {};
    const members = Array.isArray(data.members) ? data.members.slice(0, MAX_MEMBERS) : [];

    let photoLink = '';
    if (data.photo && data.photo.base64) {
      photoLink = savePhoto_(data.photo, householdName, householdId);
    }

    const householdRow = [
      now, householdId, householdName,
      clean_(data.firstName), clean_(data.lastName), clean_(data.email), clean_(data.phone),
      clean_(address.street), clean_(address.city), clean_(address.state), clean_(address.zip),
      clean_(data.contactMethod),
      members.length, photoLink,
      data.consentDirectory ? 'Yes' : 'No',
      photoLink ? (data.consentPhoto ? 'Yes' : 'No') : '',
    ];
    const memberRows = members.map(function (m) {
      return [
        now, householdId, householdName,
        clean_(m.firstName), clean_(m.lastName), clean_(m.relationship), clean_(m.occupation),
        joinList_(m.activities, m.activitiesOther),
        joinList_(m.skills, m.skillsOther),
      ];
    });

    if (!writeRows_(householdRow, memberRows)) {
      return json_({ ok: false, error: 'The server is busy. Please try again in a moment.' });
    }
    return json_({ ok: true, householdId: householdId });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong saving your information. Please try again.' });
  }
}

/**
 * Appends one submission under the script lock, so concurrent submissions can't
 * interleave or overwrite each other's rows. Keep this section short: only Sheet writes.
 * Returns false if the lock couldn't be acquired.
 */
function writeRows_(householdRow, memberRows) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return false;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheet_(ss, HOUSEHOLDS_SHEET, HOUSEHOLD_HEADERS).appendRow(householdRow);
    if (memberRows.length) {
      const membersSheet = ensureSheet_(ss, MEMBERS_SHEET, MEMBER_HEADERS);
      membersSheet.getRange(membersSheet.getLastRow() + 1, 1, memberRows.length, MEMBER_HEADERS.length)
        .setValues(memberRows);
    }
    // Commit pending writes before releasing, or the next request can read a stale getLastRow()
    // and overwrite these member rows.
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}

function validate_(d) {
  const errors = [];
  if (!str_(d.householdName)) errors.push('Household name is required.');
  if (!str_(d.firstName) || !str_(d.lastName)) errors.push('Contact name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str_(d.email))) errors.push('A valid email is required.');
  if (!str_(d.contactMethod)) errors.push('Preferred contact method is required.');
  if (!d.consentDirectory) errors.push('Directory consent is required.');

  if (d.members && !Array.isArray(d.members)) errors.push('Invalid household members.');
  (d.members || []).forEach(function (m, i) {
    if (!str_(m && m.firstName)) errors.push('Member ' + (i + 1) + ' needs a first name.');
  });

  if (d.photo && d.photo.base64) {
    if (ALLOWED_PHOTO_TYPES.indexOf(d.photo.mimeType) === -1) errors.push('Photo must be JPG or PNG.');
    if (String(d.photo.base64).length > MAX_PHOTO_BASE64) errors.push('Photo is too large.');
    if (!d.consentPhoto) errors.push('Photo consent is required when uploading a photo.');
  }
  return errors;
}

function savePhoto_(photo, householdName, householdId) {
  const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) throw new Error('FOLDER_ID not set — run setup() first.');
  const ext = photo.mimeType === 'image/png' ? 'png' : 'jpg';
  const safeName = householdName.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'Household';
  const blob = Utilities.newBlob(
    Utilities.base64Decode(photo.base64), photo.mimeType, safeName + ' ' + householdId + '.' + ext
  );
  return DriveApp.getFolderById(folderId).createFile(blob).getUrl();
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function folderExists_(id) {
  try {
    DriveApp.getFolderById(id).getName();
    return true;
  } catch (err) {
    return false;
  }
}

function str_(v) {
  return v == null ? '' : String(v).trim();
}

/** Trim, cap length, and neutralize spreadsheet formula injection. */
function clean_(v) {
  let s = str_(v).slice(0, MAX_TEXT);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function joinList_(items, other) {
  const list = (Array.isArray(items) ? items : []).slice(0, MAX_LIST_ITEMS).map(clean_).filter(String);
  const extra = clean_(other);
  if (extra) list.push(extra);
  return list.join(', ');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
