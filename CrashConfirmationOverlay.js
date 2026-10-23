/**
 * CrashConfirmationOverlay.js
 * RideGuard — Full-screen "Are you okay?" countdown shown when a
 * possible crash is detected. If the user doesn't cancel within the
 * countdown, an SMS alert is automatically sent to emergency contacts.
 *
 * Usage:
 *   1. Place this component once near the root of your app (e.g. in
 *      app/(tabs)/_layout.tsx or app/_layout.tsx), rendered always but
 *      only visible when triggered.
 *   2. From anywhere in your crash-detection logic, call:
 *        global.triggerCrashConfirmation?.();
 *      This will show the overlay and start the countdown.
 *
 * Requires:
 *   npx expo install expo-sms expo-location expo-haptics
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { sendCrashAlert } from './crashAlertService';

const COUNTDOWN_SECONDS = 10;
const ACCENT = '#D32F2F';

export default function CrashConfirmationOverlay() {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState(null); // 'cancelled' | 'sent' | 'failed'

  const intervalRef = useRef(null);
  const firedRef = useRef(false);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const trigger = useCallback(() => {
    if (visible) return; // already showing, ignore re-triggers
    firedRef.current = false;
    setOutcome(null);
    setSecondsLeft(COUNTDOWN_SECONDS);
    setVisible(true);
    Vibration.vibrate([0, 400, 200, 400]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
  }, [visible]);

  // Expose a global trigger so crash-detection logic anywhere in the
  // app can call this without prop-drilling.
  useEffect(() => {
    global.triggerCrashConfirmation = trigger;
    return () => {
      if (global.triggerCrashConfirmation === trigger) {
        global.triggerCrashConfirmation = undefined;
      }
    };
  }, [trigger]);

  const fireAlert = useCallback(async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearTimer();
    setSending(true);

    const result = await sendCrashAlert();

    setSending(false);
    setOutcome(result.success ? 'sent' : 'failed');
  }, []);

  useEffect(() => {
    if (!visible) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          fireAlert();
          return 0;
        }
        Vibration.vibrate(80);
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [visible, fireAlert]);

  const handleImOkay = () => {
    if (sending) return; // can't cancel once alert is already sending
    clearTimer();
    firedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    setOutcome('cancelled');
    // Auto-dismiss shortly after showing the "cancelled" confirmation
    setTimeout(() => setVisible(false), 1200);
  };

  const handleDismissAfterSent = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {outcome === 'cancelled' ? (
          <View style={styles.centerContent}>
            <View style={styles.okBadge}>
              <Text style={styles.okBadgeText}>✓</Text>
            </View>
            <Text style={styles.title}>Glad you're okay</Text>
            <Text style={styles.subtitle}>Alert cancelled.</Text>
          </View>
        ) : outcome === 'sent' ? (
          <View style={styles.centerContent}>
            <Text style={styles.title}>Alert sent</Text>
            <Text style={styles.subtitle}>
              Your emergency contacts have been notified with your location.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleDismissAfterSent}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : outcome === 'failed' ? (
          <View style={styles.centerContent}>
            <Text style={styles.title}>Couldn't send alert</Text>
            <Text style={styles.subtitle}>
              We weren't able to reach your emergency contacts
              automatically. Please call them directly if you need help.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleDismissAfterSent}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.centerContent}>
            <Text style={styles.title}>Possible crash detected</Text>
            <Text style={styles.subtitle}>
              Sending an alert to your emergency contacts in...
            </Text>

            <View style={styles.countdownCircle}>
              {sending ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <Text style={styles.countdownNumber}>{secondsLeft}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.imOkayButton, sending && styles.disabledButton]}
              onPress={handleImOkay}
              disabled={sending}
              activeOpacity={0.85}
            >
              <Text style={styles.imOkayText}>I'M OKAY — CANCEL</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,20,20,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerContent: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  countdownCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '800',
  },
  imOkayButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 16,
    minWidth: 260,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  imOkayText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  okBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E8E3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  okBadgeText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
