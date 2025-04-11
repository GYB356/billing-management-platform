import PDFDocument from "pdfkit";
import { Invoice, Customer, InvoiceItem } from "@prisma/client";

type InvoiceWithRelations = {
  invoice: Invoice;
  customer: Customer;
  items: InvoiceItem[];
};

export async function generateInvoicePdf(data: InvoiceWithRelations): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add company logo
      // doc.image("path/to/logo.png", 50, 45, { width: 50 });

      // Add company information
      doc
        .fontSize(20)
        .text("Your Company Name", { align: "right" })
        .fontSize(10)
        .text("123 Business Street", { align: "right" })
        .text("City, State ZIP", { align: "right" })
        .text("contact@yourcompany.com", { align: "right" })
        .moveDown();

      // Add invoice information
      doc
        .fontSize(20)
        .text("INVOICE", { align: "left" })
        .moveDown()
        .fontSize(10)
        .text(`Invoice Number: ${data.invoice.invoiceNumber}`)
        .text(`Date: ${new Date(data.invoice.createdAt).toLocaleDateString()}`)
        .text(`Due Date: ${new Date(data.invoice.dueDate).toLocaleDateString()}`)
        .moveDown();

      // Add customer information
      doc
        .fontSize(12)
        .text("Bill To:")
        .fontSize(10)
        .text(data.customer.name)
        .text(data.customer.address || "")
        .text(data.customer.email)
        .moveDown();

      // Add items table
      const tableTop = doc.y;
      const itemX = 50;
      const descriptionX = 150;
      const quantityX = 280;
      const priceX = 350;
      const amountX = 450;

      // Table headers
      doc
        .fontSize(10)
        .text("Item", itemX, tableTop)
        .text("Description", descriptionX, tableTop)
        .text("Quantity", quantityX, tableTop)
        .text("Price", priceX, tableTop)
        .text("Amount", amountX, tableTop)
        .moveDown();

      // Table rows
      let y = doc.y;
      data.items.forEach((item) => {
        doc
          .fontSize(10)
          .text(item.name, itemX, y)
          .text(item.description || "", descriptionX, y)
          .text(item.quantity.toString(), quantityX, y)
          .text(`$${item.unitPrice.toFixed(2)}`, priceX, y)
          .text(`$${(item.quantity * item.unitPrice).toFixed(2)}`, amountX, y);
        y += 20;
      });

      // Add totals
      const totalsY = y + 20;
      doc
        .fontSize(10)
        .text("Subtotal:", 350, totalsY)
        .text(`$${data.invoice.subtotal.toFixed(2)}`, amountX, totalsY)
        .text("Tax:", 350, totalsY + 20)
        .text(`$${data.invoice.tax.toFixed(2)}`, amountX, totalsY + 20)
        .text("Total:", 350, totalsY + 40)
        .text(`$${data.invoice.total.toFixed(2)}`, amountX, totalsY + 40);

      // Add footer
      doc
        .fontSize(10)
        .text(
          "Thank you for your business!",
          50,
          doc.page.height - 50,
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
} 