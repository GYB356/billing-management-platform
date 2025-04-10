import { prisma } from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/invoice/pdf";
import { uploadToStorage } from "@/lib/storage";
import { sendInvoiceEmail } from "@/lib/invoice/email";

export async function generateInvoice(
  customerId: string, 
  amount: number, 
  metadata: Record<string, any> = {}, 
  subscriptionId?: string
) {
  const nextNumber = await getNextInvoiceNumber();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  // Create the invoice record
  const invoice = await prisma.invoice.create({
    data: {
      customerId,
      amountDue: amount,
      number: nextNumber,
      status: "unpaid",
      metadata,
      dueDate,
      subscriptionId
    }
  });

  try {
    // Generate PDF
    const pdf = await generateInvoicePdf(invoice);
    
    // Upload to storage
    const url = await uploadToStorage(`invoices/${invoice.id}.pdf`, pdf);

    // Update invoice with PDF URL
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: url }
    });

    // Send email notification
    await sendInvoiceEmail(customerId, invoice, url);

    return invoice;
  } catch (error) {
    console.error('Error generating invoice:', error);
    
    // Update invoice status to failed if there's an error
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "failed" }
    });
    
    throw error;
  }
}

async function getNextInvoiceNumber() {
  const latest = await prisma.invoice.findFirst({
    orderBy: { number: "desc" },
    select: { number: true }
  });
  return (latest?.number || 0) + 1;
} 