import { retryPendingAlertIfAny } from '../crashAlertService';
import { startCrashDetection, stopCrashDetection } from '../CrashDetector';
import CrashConfirmationOverlay from '../CrashConfirmationOverlay';
import { checkAndShowBackgroundPermissionGuide } from '../backgroundPermissionGuide';
import { startCarryPositionDetection, stopCarryPositionDetection } from '../carryPositionDetector'; 
import { useEffect } from 'react';
import { startBackgroundRideDetection } from '../backgroundRideDetection';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
   const colorScheme = useColorScheme();
   useEffect(() => {
     global.onRideAutoDetected = () => {
        startCrashDetection();
        startCarryPositionDetection();
  };
  global.onRideEnded = () => {
     stopCrashDetection();
     stopCarryPositionDetection();
  };
  startBackgroundRideDetection();
  retryPendingAlertIfAny();
  checkAndShowBackgroundPermissionGuide();
}, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <CrashConfirmationOverlay />
         <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
