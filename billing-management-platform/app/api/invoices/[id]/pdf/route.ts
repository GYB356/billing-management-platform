import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/invoice/pdf";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        items: true,
      },
    });

    if (!invoice) {
      return new NextResponse("Invoice not found", { status: 404 });
    }

    // Check if user has access to this invoice
    if (invoice.customerId !== session.user.id && session.user.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(invoice);

    // Upload to storage
    const storageKey = generateStorageKey(invoice.invoiceNumber);
    const pdfUrl = await uploadToStorage(pdfBuffer, storageKey);

    // Update invoice with PDF URL
    await prisma.invoice.update({
      where: { id: params.id },
      data: { pdfUrl },
    });

    return NextResponse.json({ url: pdfUrl });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 