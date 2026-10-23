/**
 * crashAlertService.js
 * RideGuard — Sends the emergency alert once a crash is confirmed.
 *
 * Fallback chain:
 *   1. Try SMS to all emergency contacts.
 *   2. If SMS fails or can't be confirmed sent, try opening a WhatsApp
 *      message (if installed) as a second attempt, for the primary contact.
 *   3. Always logs the attempt locally (via AsyncStorage) so the app's
 *      History screen can show what happened, even if delivery failed.
 *
 * Requires:
 *   npx expo install expo-sms expo-location
 *   (AsyncStorage already installed via contactsStorage.js)
 */

import * as SMS from 'expo-sms';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getContactsForAlert } from './contactsStorage';

const ALERT_LOG_KEY = 'rideguard_alert_log_v1';
const MAX_LOG_ENTRIES = 50;
 const PENDING_ALERT_KEY = 'rideguard_pending_alert_v1';
const RETRY_INTERVAL_MS = 30000; // retry every 30s
const MAX_RETRY_WINDOW_MS = 5 * 60 * 1000; // give up after 5 minutes
let retryTimer = null;


function buildAlertMessage(coords) {
  const mapsLink = coords
    ? `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`
    : 'location unavailable';

  return (
    `RideGuard Alert: A possible crash was detected and not cancelled ` +
    `in time. Please check on me.\n\nLast known location: ${mapsLink}`
  );
}

async function getBestEffortLocation() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const last = await Location.getLastKnownPositionAsync();
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);

    const position = fresh || last;
    return position ? position.coords : null;
  } catch (e) {
    console.warn('RideGuard: failed to get location for alert', e);
    return null;
  }
}

async function logAlertAttempt(entry) {
  try {
    const raw = await AsyncStorage.getItem(ALERT_LOG_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = [{ ...entry, timestamp: Date.now() }, ...existing].slice(
      0,
      MAX_LOG_ENTRIES
    );
    await AsyncStorage.setItem(ALERT_LOG_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('RideGuard: failed to write alert log', e);
  }
}

/** Returns the full alert log, most recent first. */
export async function getAlertLog() {
  try {
    const raw = await AsyncStorage.getItem(ALERT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Opens WhatsApp with the alert message pre-filled for a single
 * phone number. Returns true if WhatsApp was reachable. Still
 * requires the user to tap Send inside WhatsApp — Android does not
 * allow silently sending WhatsApp messages from another app.
 */
async function tryWhatsAppFallback(phoneNumber, message) {
  try {
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    const url = `whatsapp://send?phone=${cleanNumber}&text=${encodeURIComponent(
      message
    )}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('RideGuard: WhatsApp fallback failed', e);
    return false;
  }
}

/**
 * Sends the crash alert to all saved emergency contacts.
 * Tries SMS first; if SMS isn't available or is cancelled, falls
 * back to opening WhatsApp for the primary contact.
 * Returns { success, channel, sentTo, error? }.
 */
async function savePendingAlert(contacts) {
  try {
    await AsyncStorage.setItem(
      PENDING_ALERT_KEY,
      JSON.stringify({ contacts, firstAttempt: Date.now() })
    );
  } catch (e) {
    console.warn('RideGuard: failed to save pending alert', e);
  }
}

async function clearPendingAlert() {
  try {
    await AsyncStorage.removeItem(PENDING_ALERT_KEY);
  } catch (e) {
    console.warn('RideGuard: failed to clear pending alert', e);
  }
}

/**
 * Checks for a pending (previously failed) alert and retries sending it.
 * Call this on app launch and periodically while a ride is active.
 * Gives up and clears the pending alert after MAX_RETRY_WINDOW_MS.
 */
export async function retryPendingAlertIfAny() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ALERT_KEY);
    if (!raw) return;

    const pending = JSON.parse(raw);
    if (Date.now() - pending.firstAttempt >= MAX_RETRY_WINDOW_MS) {
      await clearPendingAlert();
      return;
    }

    const result = await sendCrashAlert();
    if (result.success) {
      await clearPendingAlert();
    }
  } catch (e) {
    console.warn('RideGuard: retry attempt failed', e);
  }
}

/** Starts a periodic retry check. Safe to call multiple times. */
export function startPendingAlertRetries() {
  if (retryTimer) return;
  retryTimer = setInterval(retryPendingAlertIfAny, RETRY_INTERVAL_MS);
}

export function stopPendingAlertRetries() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}
export async function sendCrashAlert() {
  const contacts = await getContactsForAlert();

  if (contacts.length === 0) {
    const result = {
      success: false,
      channel: 'none',
      sentTo: [],
      error: 'No emergency contacts configured.',
    };
    await logAlertAttempt(result);
    return result;
  }

  const coords = await getBestEffortLocation();
  const message = buildAlertMessage(coords);
  const phoneNumbers = contacts.map((c) => c.phone);

  // --- Attempt 1: SMS to all contacts at once ---
  let smsOutcome = null;
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      const { result } = await SMS.sendSMSAsync(phoneNumbers, message);
      smsOutcome = result;
      if (result !== 'cancelled') {
        const success = {
          success: true,
          channel: 'sms',
          sentTo: phoneNumbers,
          result,
        };
        await logAlertAttempt(success);
        return success;
      }
    }
  } catch (e) {
    smsOutcome = 'error';
    console.warn('RideGuard: SMS attempt failed', e);
  }

  // --- Attempt 2: WhatsApp fallback (primary contact) ---
  const primary = contacts[0];
  const whatsappOpened = await tryWhatsAppFallback(primary.phone, message);

  if (whatsappOpened) {
    const partial = {
      success: true,
      channel: 'whatsapp',
      sentTo: [primary.phone],
      note: 'SMS unavailable/cancelled — opened WhatsApp as fallback. Message must still be sent manually.',
      smsOutcome,
    };
    await logAlertAttempt(partial);
    return partial;
  }

  // --- Both channels failed ---
  const failed = {
    success: false,
    channel: 'none',
    sentTo: [],
    error:
      'Could not send SMS or open WhatsApp. Please contact your emergency contacts directly.',
    smsOutcome,
  };
  await logAlertAttempt(failed);
  await savePendingAlert(contacts);
     startPendingAlertRetries();
  return failed;
}
