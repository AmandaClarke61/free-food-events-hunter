import { prisma } from "./db";
import { sendWhatsAppMessage } from "./whatsapp";
import { isProUser } from "./stripe";

export async function processReminders() {
  const now = new Date();

  // Find schedules that need reminding:
  // - Not yet reminded
  // - remindBefore > 0
  // - startTime minus remindBefore is <= now
  // - startTime is still in the future (don't remind for past events)
  const schedules = await prisma.schedule.findMany({
    where: {
      reminded: false,
      remindBefore: { gt: 0 },
      startTime: { gt: now },
    },
    include: {
      user: {
        include: {
          whatsappBinding: true,
        },
      },
    },
  });

  let sent = 0;

  for (const schedule of schedules) {
    const remindAt = new Date(
      schedule.startTime.getTime() - schedule.remindBefore * 60 * 1000
    );

    if (remindAt > now) continue; // Not time yet

    // Mark as reminded first to avoid double-sends
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { reminded: true },
    });

    // Send WhatsApp reminder only to Pro users with verified binding
    const binding = schedule.user.whatsappBinding;
    if (binding?.verified && (await isProUser(schedule.userId))) {
      const timeStr = schedule.startTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });

      const locationStr = schedule.location ? `\nLocation: ${schedule.location}` : "";

      await sendWhatsAppMessage(
        binding.phoneNumber,
        `Reminder: ${schedule.title}\nTime: ${timeStr}${locationStr}\n\nStarting in ${schedule.remindBefore} minutes!`
      );
      sent++;
    }
  }

  return { checked: schedules.length, sent };
}

export async function sendDailySummary() {
  // Find users with WhatsApp bindings
  const bindings = await prisma.whatsAppBinding.findMany({
    where: { verified: true },
    include: { user: true },
  });

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  let sent = 0;

  for (const binding of bindings) {
    // Only send daily summary to Pro users
    if (!(await isProUser(binding.userId))) continue;

    // Get user's schedules for today
    const schedules = await prisma.schedule.findMany({
      where: {
        userId: binding.userId,
        startTime: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { startTime: "asc" },
    });

    // Get free food events today
    const freeFoodEvents = await prisma.event.findMany({
      where: {
        hasFreeFood: true,
        startTime: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { startTime: "asc" },
      take: 5,
    });

    if (schedules.length === 0 && freeFoodEvents.length === 0) continue;

    let msg = "Good morning! Here's your daily summary:\n";

    if (schedules.length > 0) {
      msg += "\n--- Your Schedule ---\n";
      for (const s of schedules) {
        const time = s.startTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        });
        msg += `${time} - ${s.title}${s.location ? ` (${s.location})` : ""}\n`;
      }
    }

    if (freeFoodEvents.length > 0) {
      msg += "\n--- Free Food Today ---\n";
      for (const e of freeFoodEvents) {
        const time = e.startTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
        });
        msg += `${time} - ${e.title}${e.foodDetails ? ` (${e.foodDetails})` : ""}\n`;
      }
    }

    await sendWhatsAppMessage(binding.phoneNumber, msg);
    sent++;
  }

  return { users: bindings.length, sent };
}
