import { useState } from 'react';
import { MINISTRIES, RELATIONSHIPS, SKILLS } from './fields';
import type { Member } from './types';

interface Props {
  member: Member;
  index: number;
  primaryName: string;
  defaultLastName: string;
  error?: string;
  onChange: (patch: Partial<Member>) => void;
  onRemove?: () => void;
}

export function MemberCard({ member, index, primaryName, defaultLastName, error, onChange, onRemove }: Props) {
  const [open, setOpen] = useState(true);
  const idp = `m${member.id}`;

  const title = member.isPrimary
    ? `${primaryName || 'You'} (primary contact)`
    : [member.firstName, member.lastName].filter(Boolean).join(' ') || `Household member ${index + 1}`;

  const toggle = (list: 'activities' | 'skills', value: string) => {
    const current = member[list];
    onChange({ [list]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };

  return (
    <fieldset className="member-card">
      <div className="member-header">
        <button type="button" className="member-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="chevron" aria-hidden>{open ? '▾' : '▸'}</span>
          {title}
        </button>
        {onRemove && (
          <button type="button" className="link-button danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {open && (
        <div className="member-body">
          {!member.isPrimary && (
            <div className="row">
              <label>
                First name <span className="req">*</span>
                <input
                  value={member.firstName}
                  maxLength={100}
                  onChange={(e) => onChange({ firstName: e.target.value })}
                  aria-invalid={!!error}
                />
                {error && <span className="error">{error}</span>}
              </label>
              <label>
                Last name
                <input
                  value={member.lastName}
                  maxLength={100}
                  placeholder={defaultLastName}
                  onChange={(e) => onChange({ lastName: e.target.value })}
                />
              </label>
              <label>
                Relationship
                <select value={member.relationship} onChange={(e) => onChange({ relationship: e.target.value })}>
                  <option value="">Select…</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label>
            Career / occupation <span className="optional">optional</span>
            <input
              value={member.occupation}
              maxLength={200}
              placeholder="e.g. Nurse, Retired teacher, Student"
              onChange={(e) => onChange({ occupation: e.target.value })}
            />
          </label>

          <div className="group">
            <span className="group-label">
              Current church activities <span className="optional">optional</span>
            </span>
            <div className="checkbox-grid">
              {MINISTRIES.map((m) => (
                <label key={m} className="checkbox">
                  <input type="checkbox" checked={member.activities.includes(m)} onChange={() => toggle('activities', m)} />
                  {m}
                </label>
              ))}
            </div>
            <input
              id={`${idp}-act-other`}
              value={member.activitiesOther}
              maxLength={200}
              placeholder="Other activities"
              aria-label="Other church activities"
              onChange={(e) => onChange({ activitiesOther: e.target.value })}
            />
          </div>

          <div className="group">
            <span className="group-label">
              Services or skills they could offer the parish <span className="optional">optional</span>
            </span>
            <div className="checkbox-grid">
              {SKILLS.map((s) => (
                <label key={s} className="checkbox">
                  <input type="checkbox" checked={member.skills.includes(s)} onChange={() => toggle('skills', s)} />
                  {s}
                </label>
              ))}
            </div>
            <input
              id={`${idp}-skill-other`}
              value={member.skillsOther}
              maxLength={200}
              placeholder="Other skills or services"
              aria-label="Other skills or services"
              onChange={(e) => onChange({ skillsOther: e.target.value })}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
