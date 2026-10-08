import { useRef, useState, type FormEvent } from 'react';
import { submitRegistration } from './api';
import { CONTACT_METHODS, INTRO_TEXT, PARISH_NAME, PRIVACY_NOTE } from './fields';
import { resizeImage } from './imageResize';
import { MemberCard } from './MemberCard';
import type { Errors, FormState, Member } from './types';

let nextId = 0;
const newMember = (isPrimary = false): Member => ({
  id: String(nextId++),
  isPrimary,
  firstName: '',
  lastName: '',
  relationship: '',
  occupation: '',
  activities: [],
  activitiesOther: '',
  skills: [],
  skillsOther: '',
});

const initialState = (): FormState => ({
  householdName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: { street: '', city: '', state: '', zip: '' },
  contactMethod: 'Email',
  members: [newMember(true)],
  photo: null,
  consentDirectory: false,
  consentPhoto: false,
  website: '',
});

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.householdName.trim()) e.householdName = 'Please enter your household or family name.';
  if (!f.firstName.trim()) e.firstName = 'Required.';
  if (!f.lastName.trim()) e.lastName = 'Required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Please enter a valid email address.';
  if (f.contactMethod === 'Phone' && !f.phone.trim()) e.phone = 'Please add a phone number, or choose another contact method.';
  if (f.contactMethod === 'Mail' && (!f.address.street.trim() || !f.address.city.trim()))
    e.address = 'Please add your mailing address, or choose another contact method.';
  f.members.forEach((m) => {
    if (!m.isPrimary && !m.firstName.trim()) e[`member-${m.id}`] = 'Please enter a first name or remove this member.';
  });
  if (!f.consentDirectory) e.consentDirectory = 'Please confirm to continue.';
  if (f.photo && !f.consentPhoto) e.consentPhoto = 'Please confirm, or remove the photo.';
  return e;
}

export default function App() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Errors>({});
  const [photoError, setPhotoError] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'submitting' | 'done' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAddress = (key: keyof FormState['address'], value: string) =>
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  const updateMember = (id: string, patch: Partial<Member>) =>
    setForm((f) => ({ ...f, members: f.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const removeMember = (id: string) => setForm((f) => ({ ...f, members: f.members.filter((m) => m.id !== id) }));

  async function onPhotoChange(file: File | undefined) {
    setPhotoError('');
    if (!file) return;
    setStatus('processing');
    try {
      set('photo', await resizeImage(file));
    } catch (err) {
      setPhotoError((err as Error).message);
      if (fileInput.current) fileInput.current.value = '';
    } finally {
      setStatus('idle');
    }
  }

  function removePhoto() {
    set('photo', null);
    set('consentPhoto', false);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"], .error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    setStatus('submitting');
    setSubmitError('');
    try {
      await submitRegistration(form);
      setStatus('done');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError((err as Error).message);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <main className="container">
        <div className="card success">
          <h1>Thank you!</h1>
          <p>Your household information has been received by {PARISH_NAME}. God bless!</p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setForm(initialState());
              setErrors({});
              setStatus('idle');
            }}
          >
            Submit another household
          </button>
        </div>
      </main>
    );
  }

  const busy = status === 'submitting' || status === 'processing';
  const primaryName = [form.firstName, form.lastName].filter(Boolean).join(' ');

  return (
    <main className="container">
      <header>
        <p className="eyebrow">{PARISH_NAME}</p>
        <h1>Parish Directory Registration</h1>
        <p className="lede">{INTRO_TEXT}</p>
      </header>

      <form onSubmit={onSubmit} noValidate>
        {/* Honeypot: hidden from people, bots fill it in */}
        <div className="hp" aria-hidden>
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
          </label>
        </div>

        <section className="card">
          <h2>Household</h2>
          <label>
            Household / family name <span className="req">*</span>
            <input
              value={form.householdName}
              maxLength={100}
              placeholder="e.g. The Garcia Family"
              onChange={(e) => set('householdName', e.target.value)}
              aria-invalid={!!errors.householdName}
            />
            {errors.householdName && <span className="error">{errors.householdName}</span>}
          </label>

          <h3>Primary contact</h3>
          <div className="row">
            <label>
              First name <span className="req">*</span>
              <input
                value={form.firstName}
                maxLength={100}
                autoComplete="given-name"
                onChange={(e) => set('firstName', e.target.value)}
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && <span className="error">{errors.firstName}</span>}
            </label>
            <label>
              Last name <span className="req">*</span>
              <input
                value={form.lastName}
                maxLength={100}
                autoComplete="family-name"
                onChange={(e) => set('lastName', e.target.value)}
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && <span className="error">{errors.lastName}</span>}
            </label>
          </div>
          <div className="row">
            <label>
              Email <span className="req">*</span>
              <input
                type="email"
                value={form.email}
                maxLength={200}
                autoComplete="email"
                onChange={(e) => set('email', e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && <span className="error">{errors.email}</span>}
            </label>
            <label>
              Phone <span className="optional">optional</span>
              <input
                type="tel"
                value={form.phone}
                maxLength={40}
                autoComplete="tel"
                onChange={(e) => set('phone', e.target.value)}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <span className="error">{errors.phone}</span>}
            </label>
          </div>

          <h3>
            Mailing address <span className="optional">optional</span>
          </h3>
          <label>
            Street
            <input value={form.address.street} maxLength={200} autoComplete="street-address" onChange={(e) => setAddress('street', e.target.value)} />
          </label>
          <div className="row three">
            <label>
              City
              <input value={form.address.city} maxLength={100} autoComplete="address-level2" onChange={(e) => setAddress('city', e.target.value)} />
            </label>
            <label>
              State
              <input value={form.address.state} maxLength={50} autoComplete="address-level1" onChange={(e) => setAddress('state', e.target.value)} />
            </label>
            <label>
              ZIP
              <input value={form.address.zip} maxLength={20} autoComplete="postal-code" inputMode="numeric" onChange={(e) => setAddress('zip', e.target.value)} />
            </label>
          </div>
          {errors.address && <span className="error">{errors.address}</span>}

          <div className="group">
            <span className="group-label">
              Preferred way to contact you <span className="req">*</span>
            </span>
            <div className="radio-row">
              {CONTACT_METHODS.map((m) => (
                <label key={m} className="checkbox">
                  <input type="radio" name="contactMethod" checked={form.contactMethod === m} onChange={() => set('contactMethod', m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Household members</h2>
          <p className="hint">
            Tell us about each person in your household. Everything except first names is optional, and these details are
            only visible to parish staff.
          </p>
          {form.members.map((m, i) => (
            <MemberCard
              key={m.id}
              member={m}
              index={i}
              primaryName={primaryName}
              defaultLastName={form.lastName}
              error={errors[`member-${m.id}`]}
              onChange={(patch) => updateMember(m.id, patch)}
              onRemove={m.isPrimary ? undefined : () => removeMember(m.id)}
            />
          ))}
          {form.members.length < 20 && (
            <button type="button" className="secondary" onClick={() => set('members', [...form.members, newMember()])}>
              + Add household member
            </button>
          )}
        </section>

        <section className="card">
          <h2>
            Family photo <span className="optional">optional</span>
          </h2>
          <p className="hint">A photo helps our community put names to faces.</p>
          {form.photo ? (
            <div className="photo-preview">
              <img src={form.photo.previewUrl} alt="Selected family photo" />
              <button type="button" className="link-button danger" onClick={removePhoto}>
                Remove photo
              </button>
            </div>
          ) : (
            <label className="file-drop">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
                onChange={(e) => onPhotoChange(e.target.files?.[0])}
              />
              <span>{status === 'processing' ? 'Preparing photo…' : 'Choose a photo or take one'}</span>
            </label>
          )}
          {photoError && <span className="error">{photoError}</span>}
        </section>

        <section className="card">
          <h2>Consent</h2>
          <label className="checkbox consent">
            <input
              type="checkbox"
              checked={form.consentDirectory}
              onChange={(e) => set('consentDirectory', e.target.checked)}
              aria-invalid={!!errors.consentDirectory}
            />
            <span>
              I agree that {PARISH_NAME} may store this information and include our household in the parish directory.{' '}
              <span className="req">*</span>
            </span>
          </label>
          {errors.consentDirectory && <span className="error">{errors.consentDirectory}</span>}
          {form.photo && (
            <>
              <label className="checkbox consent">
                <input
                  type="checkbox"
                  checked={form.consentPhoto}
                  onChange={(e) => set('consentPhoto', e.target.checked)}
                  aria-invalid={!!errors.consentPhoto}
                />
                <span>
                  I have permission from everyone in the photo for it to be used in the parish directory.{' '}
                  <span className="req">*</span>
                </span>
              </label>
              {errors.consentPhoto && <span className="error">{errors.consentPhoto}</span>}
            </>
          )}
          <p className="hint privacy">{PRIVACY_NOTE}</p>
        </section>

        {status === 'error' && <div className="alert">{submitError}</div>}

        <button type="submit" className="primary" disabled={busy}>
          {status === 'submitting' ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </main>
  );
}
