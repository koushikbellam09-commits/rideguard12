/**
 * crashDetector.js
 * RideGuard — Watches the accelerometer for a sudden impact spike.
 * When one is detected, triggers the CrashConfirmationOverlay via
 * global.triggerCrashConfirmation().
 *
 * Sensitivity is read from AsyncStorage (set in Settings) and maps
 * to a G-force threshold: lower threshold = more sensitive.
 */

import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SENSITIVITY_KEY = 'rideguard_sensitivity';

const THRESHOLDS = {
  Low: 3.5,
  Medium: 2.5,
  High: 1.6,
};

let subscription = null;

export async function startCrashDetection() {
  if (subscription) return; // already running

  const savedSensitivity = (await AsyncStorage.getItem(SENSITIVITY_KEY)) || 'Medium';
  const threshold = THRESHOLDS[savedSensitivity] ?? THRESHOLDS.Medium;

  Accelerometer.setUpdateInterval(200);

  subscription = Accelerometer.addListener((data) => {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    // Resting magnitude is ~1g; a crash causes a sharp spike above that.
    if (magnitude >= threshold) {
      global.triggerCrashConfirmation?.();
    }
  });
}

export function stopCrashDetection() {
  subscription?.remove();
  subscription = null;
}