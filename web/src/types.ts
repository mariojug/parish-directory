export interface Member {
  id: string;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  relationship: string;
  occupation: string;
  activities: string[];
  activitiesOther: string;
  skills: string[];
  skillsOther: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Photo {
  base64: string;
  mimeType: 'image/jpeg';
  previewUrl: string;
}

export interface FormState {
  submissionId: string; // lets the server ignore a re-submit of the same form
  householdName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: Address;
  contactMethod: string;
  members: Member[];
  photo: Photo | null;
  consentDirectory: boolean;
  consentPhoto: boolean;
  website: string; // honeypot — must stay empty
}

export type Errors = Partial<Record<string, string>>;
