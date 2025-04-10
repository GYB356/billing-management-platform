import { NotificationTemplate } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';

export async function sendEmail(
  userId: string,
  template: NotificationTemplate,
  data: Record<string, any>
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return;

  const subject = template.subject.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || "");
  const body = template.body.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] || "");

  await sendMail({
    to: user.email,
    subject,
    html: body,
  });
} 