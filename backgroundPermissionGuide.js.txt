import { Alert, Linking, Platform } from 'react-native';

const STORAGE_KEY_SHOWN = 'rideguard_bg_permission_guide_shown';

export function checkAndShowBackgroundPermissionGuide() {
  if (Platform.OS !== 'android') return;

  if (global.__rideguardGuideShown) return;
  global.__rideguardGuideShown = true;

  Alert.alert(
    'Keep RideGuard Running',
    'For crash detection to keep working when your phone is locked or in your pocket, please allow RideGuard to run in the background.\n\nSteps:\n1. Open Settings > Apps > RideGuard > Battery\n2. Select "No restrictions" or "Allow background activity"\n3. On some phones (Xiaomi, Vivo, Oppo), also enable "Autostart" for RideGuard',
    [
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings();
        },
      },
      {
        text: 'Later',
        style: 'cancel',
      },
    ],
    { cancelable: true }
  );
}