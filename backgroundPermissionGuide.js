import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

const STORAGE_KEY_SHOWN = 'rideguard_bg_permission_guide_shown';

function getBrandInstructions() {
  const brand = (Device.brand || '').toLowerCase();
  const manufacturer = (Device.manufacturer || '').toLowerCase();
  const combined = `${brand} ${manufacturer}`;

  if (combined.includes('xiaomi') || combined.includes('redmi') || combined.includes('poco')) {
    return (
      '1. Settings > Apps > Manage apps > RideGuard > Battery saver > No restrictions\n' +
      '2. Settings > Apps > Permissions > Autostart > enable RideGuard\n' +
      '3. Recent apps > long-press RideGuard card > Lock (padlock icon)'
    );
  }
  if (combined.includes('vivo')) {
    return (
      '1. Settings > Battery > Background power consumption management > RideGuard > Allow\n' +
      '2. i Manager > App manager > Autostart > enable RideGuard\n' +
      '3. Recent apps > swipe down on RideGuard card to lock it'
    );
  }
  if (combined.includes('oppo') || combined.includes('realme')) {
    return (
      '1. Settings > Battery > RideGuard > Allow background activity\n' +
      '2. Settings > App management > Autostart manager > enable RideGuard\n' +
      '3. Recent apps > long-press RideGuard card > Lock'
    );
  }
  if (combined.includes('samsung')) {
    return (
      '1. Settings > Apps > RideGuard > Battery > Unrestricted\n' +
      '2. Settings > Battery > Background usage limits > make sure RideGuard is not in "Sleeping apps"'
    );
  }
  if (combined.includes('oneplus')) {
    return (
      '1. Settings > Battery > Battery optimization > RideGuard > Don\'t optimize\n' +
      '2. Settings > Apps > Special app access > enable Auto-launch for RideGuard'
    );
  }

  return (
    '1. Settings > Apps > RideGuard > Battery > select "No restrictions" or "Allow background activity"\n' +
    '2. If your phone has an "Autostart" or "App launch" setting, enable it for RideGuard'
  );
}

export async function checkAndShowBackgroundPermissionGuide() {
  if (Platform.OS !== 'android') return;

  try {
    const alreadyShown = await AsyncStorage.getItem(STORAGE_KEY_SHOWN);
    if (alreadyShown) return;

    const steps = getBrandInstructions();
    const brandLabel = Device.brand || Device.manufacturer || 'your phone';

    Alert.alert(
      'Keep RideGuard Running',
      `For crash detection to keep working when your phone is locked or in your pocket, please allow RideGuard to run in the background.\n\nSteps for ${brandLabel}:\n${steps}`,
      [
        {
          text: 'Open Settings',
          onPress: async () => {
            await AsyncStorage.setItem(STORAGE_KEY_SHOWN, 'true');
            Linking.openSettings();
          },
        },
        {
          text: 'Later',
          style: 'cancel',
          onPress: async () => {
            await AsyncStorage.setItem(STORAGE_KEY_SHOWN, 'true');
          },
        },
      ],
      { cancelable: true }
    );
  } catch (e) {
    console.warn('RideGuard: failed to show background permission guide', e);
  }
}