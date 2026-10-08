import type { FormState } from './types';

const ENDPOINT = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;

/**
 * Sends the registration to the Apps Script web app.
 * Uses text/plain so the browser skips a CORS preflight (Apps Script can't answer OPTIONS).
 */
export async function submitRegistration(form: FormState): Promise<void> {
  if (!ENDPOINT) {
    throw new Error('This form is not connected yet. Please contact the parish office.');
  }

  const members = form.members.map(({ id: _id, isPrimary, ...m }) =>
    isPrimary
      ? { ...m, firstName: form.firstName, lastName: form.lastName, relationship: 'Self' }
      : { ...m, lastName: m.lastName.trim() || form.lastName },
  );

  const payload = {
    householdName: form.householdName,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    address: form.address,
    contactMethod: form.contactMethod,
    members,
    photo: form.photo ? { base64: form.photo.base64, mimeType: form.photo.mimeType } : null,
    consentDirectory: form.consentDirectory,
    consentPhoto: form.consentPhoto,
    website: form.website,
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
  } catch {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Something went wrong. Please try again.');
  }
}
