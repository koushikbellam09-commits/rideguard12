import { LightSensor, Accelerometer } from 'expo-sensors';

let lightSubscription = null;
let accelSubscription = null;

let recentLight = [];
let recentAccelVariance = [];

const LIGHT_DARK_THRESHOLD = 10;
const HISTORY_SIZE = 10;

let currentPosition = 'unknown';

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
  if (arr.length < 2) return 0;
  const avg = average(arr);
  const sqDiffs = arr.map((v) => (v - avg) ** 2);
  return average(sqDiffs);
}

function updatePositionEstimate() {
  const avgLight = average(recentLight);
  const avgVariance = average(recentAccelVariance);

  const isDark = avgLight < LIGHT_DARK_THRESHOLD;
  const isJostling = avgVariance > 0.5;

  let position;
  if (isDark && isJostling) {
    position = 'pocket';
  } else if (isDark && !isJostling) {
    position = 'bag';
  } else if (!isDark && avgVariance > 0.15) {
    position = 'mounted';
  } else {
    position = 'hand';
  }

  if (position !== currentPosition) {
    currentPosition = position;
    global.onCarryPositionChanged?.(position);
  }
}

export function startCarryPositionDetection() {
  lightSubscription = LightSensor.addListener((data) => {
    recentLight.push(data.illuminance);
    if (recentLight.length > HISTORY_SIZE) recentLight.shift();
  });
  LightSensor.setUpdateInterval(2000);

  let lastMagnitude = null;
  accelSubscription = Accelerometer.addListener((data) => {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    if (lastMagnitude !== null) {
      const delta = Math.abs(magnitude - lastMagnitude);
      recentAccelVariance.push(delta);
      if (recentAccelVariance.length > HISTORY_SIZE) recentAccelVariance.shift();
    }
    lastMagnitude = magnitude;
    updatePositionEstimate();
  });
  Accelerometer.setUpdateInterval(500);
}

export function stopCarryPositionDetection() {
  lightSubscription?.remove();
  accelSubscription?.remove();
  lightSubscription = null;
  accelSubscription = null;
}

export function getCurrentCarryPosition() {
  return currentPosition;
}