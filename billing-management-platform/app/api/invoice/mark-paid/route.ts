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
    const { invoiceId } = body;

    if (!invoiceId) {
      return new NextResponse("Invoice ID is required", { status: 400 });
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error marking invoice as paid:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 