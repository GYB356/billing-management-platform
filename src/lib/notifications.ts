import nodemailer from 'nodemailer';
// ...existing code...

export async function sendInvoiceEmail(customerEmail: string, invoiceUrl: string) {
  const transporter = nodemailer.createTransport({
    // Configure email transport
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: customerEmail,
    subject: 'Your Invoice',
    text: `Your invoice is ready. You can download it here: ${invoiceUrl}`,
  };

  await transporter.sendMail(mailOptions);
}
