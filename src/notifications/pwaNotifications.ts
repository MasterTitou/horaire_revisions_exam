export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    alert("Les notifications Web Push ne sont pas supportées sur ce navigateur.");
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendPushNotification(title: string, body: string, icon = '🍅') {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${icon} ${title}`, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    });
  }
}

export function scheduleSlotReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const morningSlot = new Date();
  morningSlot.setHours(8, 0, 0, 0);

  const afternoonSlot = new Date();
  afternoonSlot.setHours(14, 0, 0, 0);

  // Check if morning slot is within next hour
  if (now < morningSlot && morningSlot.getTime() - now.getTime() < 3600000) {
    sendPushNotification("Créneau Stratégie & Réflexion", "Le créneau du matin (08h00) démarre bientôt ! Préparez vos tâches d'architecture et de conception.");
  }

  // Check if afternoon slot is within next hour
  if (now < afternoonSlot && afternoonSlot.getTime() - now.getTime() < 3600000) {
    sendPushNotification("Créneau Exécution & Production", "Le créneau de l'après-midi (14h00) démarre bientôt ! Préparez vos tâches d'implémentation.");
  }
}
