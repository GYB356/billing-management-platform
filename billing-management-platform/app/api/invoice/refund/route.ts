import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, amount, reason } = body;

    if (!invoiceId || !amount || !reason) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return new NextResponse("Invoice not found", { status: 404 });
    }

    // Create credit note
    const creditNote = await prisma.creditNote.create({
      data: {
        invoiceId,
        amount,
        reason,
      },
    });

    // Update invoice amount due
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountDue: invoice.amountDue - amount,
      },
    });

    return NextResponse.json(creditNote);
  } catch (error) {
    console.error("Error processing refund:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 