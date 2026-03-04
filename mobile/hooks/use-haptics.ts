import * as Haptics from 'expo-haptics';

export function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  Haptics.impactAsync(style).catch(() => {
    // Silently fail — haptics may not be available (e.g., simulator)
  });
}

export function triggerNotification(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
) {
  Haptics.notificationAsync(type).catch(() => {});
}
