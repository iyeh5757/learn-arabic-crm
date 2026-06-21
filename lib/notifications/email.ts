// lib/notifications/email.ts
// Resend email integration for session reminders

import { Resend } from 'resend'
import type { SessionReminderData } from './whatsapp'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.RESEND_FROM_EMAIL ?? 'reminders@learnarabic.com'

function formatTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Cairo',
    weekday: 'long', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function buildHtml(data: SessionReminderData): string {
  const time = formatTime(data.startAt)
  const meetBlock = data.meetLink ? `
    <div style="margin:24px 0;text-align:center;">
      <a href="${data.meetLink}"
         style="display:inline-block;background:#0D1B2A;color:#E8C97A;
                padding:12px 28px;border-radius:8px;text-decoration:none;
                font-weight:700;font-size:15px;">
        🎥 Join Google Meet
      </a>
    </div>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#0D1B2A;padding:24px 32px;">
      <div style="font-family:serif;font-size:28px;color:#C9A84C;margin-bottom:2px;">تعلم</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.6);">Learn Arabic</div>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <div style="display:inline-block;background:#FEF9C3;color:#713F12;
                  padding:4px 12px;border-radius:20px;font-size:12px;
                  font-weight:700;margin-bottom:16px;">
        ⏰ Reminder — ${data.hoursBeforeLabel} to go
      </div>
      <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
        Your class is coming up!
      </h2>
      <p style="color:#6B7280;font-size:15px;margin:0 0 24px;">
        Hi <strong>${data.studentName}</strong>, here are your session details:
      </p>

      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#9CA3AF;font-size:13px;width:40%;">📚 Subject</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.sessionType}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9CA3AF;font-size:13px;">👩‍🏫 Teacher</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.teacherName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9CA3AF;font-size:13px;">🗓 Date & Time</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${time}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#9CA3AF;font-size:13px;">⏱ Duration</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${data.durationMins} minutes</td>
          </tr>
        </table>
      </div>

      ${meetBlock}

      <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:24px 0 0;">
        You're receiving this because you have a scheduled Arabic class.<br>
        Learn Arabic Academy
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendEmailReminder(
  to: string,
  data: SessionReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const subjectMap: Record<string, string> = {
    '24 hours': '📚 Your Arabic class is tomorrow',
    '12 hours': '📚 Your Arabic class is in 12 hours',
    '1 hour':   '📚 Your Arabic class starts in 1 hour!',
  }

  try {
    const { error } = await resend.emails.send({
      from:    FROM,
      to:      [to],
      subject: subjectMap[data.hoursBeforeLabel] ?? '📚 Arabic class reminder',
      html:    buildHtml(data),
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' }
  }
}
