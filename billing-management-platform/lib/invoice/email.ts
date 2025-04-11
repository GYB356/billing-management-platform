import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/email";

export async function sendInvoiceEmail(customerId: string, pdfUrl: string) {
  const customer = await prisma.user.findUnique({
    where: { id: customerId }
  });
  
  if (!customer?.email) return;

  await sendMail({
    to: customer.email,
    subject: `Your Invoice is Ready`,
    html: `<p>Hi ${customer.name},</p><p>Your invoice is ready. <a href="${pdfUrl}">View Invoice</a></p>`
  });
} 