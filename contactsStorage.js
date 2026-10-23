/**
 * contactsStorage.js
 * RideGuard — Persistent emergency contacts storage.
 *
 * Requires:
 *   npx expo install @react-native-async-storage/async-storage
 *
 * Provides validated CRUD operations backed by AsyncStorage.
 * Contacts are the recipients for crash-alert SMS messages.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'rideguard_emergency_contacts_v1';
const MAX_CONTACTS = 5;

// ---- Validation --------------------------------------------------------

/**
 * Validates an Indian mobile number.
 * Accepts: 10-digit numbers, optionally prefixed with +91, 91, or 0.
 * Returns the normalized E.164-ish form (+91XXXXXXXXXX) or null if invalid.
 */
export function normalizeIndianPhone(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const digitsOnly = raw.replace(/[^\d+]/g, '');
  let stripped = digitsOnly.replace(/^\+?91/, '').replace(/^0/, '');

  // Must be exactly 10 digits, and must start with 6-9 (valid Indian mobile prefixes)
  if (!/^[6-9]\d{9}$/.test(stripped)) {
    return null;
  }

  return `+91${stripped}`;
}

export function validateContactName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 50;
}

// ---- Storage operations -------------------------------------------------

/**
 * Returns all saved contacts as an array of:
 * { id: string, name: string, phone: string, relationship: string, isPrimary: boolean }
 */
export async function getContacts() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn('RideGuard: failed to read contacts', e);
    return [];
  }
}

async function saveContacts(contacts) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    return true;
  } catch (e) {
    console.warn('RideGuard: failed to save contacts', e);
    return false;
  }
}

/**
 * Adds a new contact. Returns { success, error?, contact? }.
 */
export async function addContact({ name, phone, relationship = '' }) {
  if (!validateContactName(name)) {
    return { success: false, error: 'Name must be 2–50 characters.' };
  }

  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return {
      success: false,
      error: 'Enter a valid 10-digit Indian mobile number.',
    };
  }

  const existing = await getContacts();

  if (existing.length >= MAX_CONTACTS) {
    return {
      success: false,
      error: `You can save up to ${MAX_CONTACTS} emergency contacts.`,
    };
  }

  if (existing.some((c) => c.phone === normalizedPhone)) {
    return { success: false, error: 'This number is already saved.' };
  }

  const newContact = {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    phone: normalizedPhone,
    relationship: relationship.trim(),
    isPrimary: existing.length === 0, // first contact added becomes primary by default
  };

  const updated = [...existing, newContact];
  const saved = await saveContacts(updated);

  if (!saved) {
    return { success: false, error: 'Could not save contact. Try again.' };
  }

  return { success: true, contact: newContact };
}

/**
 * Updates an existing contact by id. Returns { success, error? }.
 */
export async function updateContact(id, { name, phone, relationship }) {
  const existing = await getContacts();
  const index = existing.findIndex((c) => c.id === id);

  if (index === -1) {
    return { success: false, error: 'Contact not found.' };
  }

  const updatedContact = { ...existing[index] };

  if (name !== undefined) {
    if (!validateContactName(name)) {
      return { success: false, error: 'Name must be 2–50 characters.' };
    }
    updatedContact.name = name.trim();
  }

  if (phone !== undefined) {
    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return {
        success: false,
        error: 'Enter a valid 10-digit Indian mobile number.',
      };
    }
    const duplicate = existing.some(
      (c) => c.id !== id && c.phone === normalizedPhone
    );
    if (duplicate) {
      return { success: false, error: 'This number is already saved.' };
    }
    updatedContact.phone = normalizedPhone;
  }

  if (relationship !== undefined) {
    updatedContact.relationship = relationship.trim();
  }

  existing[index] = updatedContact;
  const saved = await saveContacts(existing);

  if (!saved) {
    return { success: false, error: 'Could not update contact. Try again.' };
  }

  return { success: true, contact: updatedContact };
}

/**
 * Deletes a contact by id. If the deleted contact was primary,
 * promotes the next remaining contact (if any) to primary.
 */
export async function deleteContact(id) {
  const existing = await getContacts();
  const target = existing.find((c) => c.id === id);

  if (!target) {
    return { success: false, error: 'Contact not found.' };
  }

  let remaining = existing.filter((c) => c.id !== id);

  if (target.isPrimary && remaining.length > 0) {
    remaining = remaining.map((c, i) => ({ ...c, isPrimary: i === 0 }));
  }

  const saved = await saveContacts(remaining);

  if (!saved) {
    return { success: false, error: 'Could not delete contact. Try again.' };
  }

  return { success: true };
}

/**
 * Sets a contact as primary (used for SMS priority ordering).
 * Only one contact can be primary at a time.
 */
export async function setPrimaryContact(id) {
  const existing = await getContacts();
  const target = existing.find((c) => c.id === id);

  if (!target) {
    return { success: false, error: 'Contact not found.' };
  }

  const updated = existing.map((c) => ({ ...c, isPrimary: c.id === id }));
  const saved = await saveContacts(updated);

  if (!saved) {
    return { success: false, error: 'Could not update primary contact.' };
  }

  return { success: true };
}

/**
 * Returns contacts ordered with primary first — this is the order
 * the crash-alert SMS pipeline should use when sending.
 */
export async function getContactsForAlert() {
  const contacts = await getContacts();
  return [...contacts].sort((a, b) => {
    if (a.isPrimary === b.isPrimary) return 0;
    return a.isPrimary ? -1 : 1;
  });
}

export const CONTACTS_LIMIT = MAX_CONTACTS;
