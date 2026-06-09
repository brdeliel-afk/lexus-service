export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function scheduleNotification(title, body, isoTime, tag) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  const delay = new Date(isoTime).getTime() - Date.now();
  if (delay <= 0) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    title,
    body,
    delay,
    tag
  });
}

export function scheduleMorningBriefing(hour = 8, tasksCount, carsCount) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  navigator.serviceWorker.controller.postMessage({
    type: 'SCHEDULE_NOTIFICATION',
    title: 'בוקר טוב — סיכום יום',
    body: `${tasksCount} משימות פתוחות · ${carsCount} חליפיים תפוסים`,
    delay,
    tag: 'morning-briefing'
  });
}

export function scheduleTaskReminder(task) {
  if (!task.remind) return;
  scheduleNotification(
    `תזכורת: ${task.name}`,
    task.note || `סטטוס: ${task.status === 'me' ? 'ממתין לי' : task.status === 'manager' ? 'ממתין למנהל' : 'ממתין למחסן'}`,
    task.remind,
    `task-${task.id}`
  );
}

export function scheduleLoanerReminder(booking, carName, carPlate) {
  const returnDate = new Date(booking.returnEst);
  const dayBefore = new Date(returnDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(17, 0, 0, 0);
  if (dayBefore > new Date()) {
    scheduleNotification(
      `חליפי חוזר מחר`,
      `${booking.customer} מחזיר את ${carName} (${carPlate}) מחר ב-${returnDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
      dayBefore.toISOString(),
      `loaner-${booking.id}`
    );
  }
}
