import { formatCurrency } from '../currency';

interface PaymentRecoveryTemplateData {
  customerName: string;
  amount: number;
  currency: string;
  daysPastDue: number;
  dueDate: Date;
  nextRetryDate?: Date;
  planName: string;
  updatePaymentUrl: string;
  companyName: string;
  supportEmail: string;
}

export const paymentFailedTemplate = (data: PaymentRecoveryTemplateData) => `
<!DOCTYPE html>
<html>
<body>
  <h1>Payment Failed</h1>
  <p>Dear ${data.customerName},</p>
  <p>We were unable to process your payment of ${formatCurrency(data.amount, data.currency)} for your ${data.planName} subscription.</p>
  ${data.nextRetryDate ? `
  <p>We will automatically retry the payment on ${data.nextRetryDate.toLocaleDateString()}. To ensure successful payment, please verify your payment method is up to date.</p>
  ` : ''}
  <p><a href="${data.updatePaymentUrl}">Update Payment Method</a></p>
  <p>If you need assistance, please contact our support team at ${data.supportEmail}.</p>
  <p>Best regards,<br>${data.companyName}</p>
</body>
</html>
`;

export const paymentPastDueTemplate = (data: PaymentRecoveryTemplateData) => `
<!DOCTYPE html>
<html>
<body>
  <h1>Payment Past Due</h1>
  <p>Dear ${data.customerName},</p>
  <p>This is a reminder that your payment of ${formatCurrency(data.amount, data.currency)} for your ${data.planName} subscription is now ${data.daysPastDue} days past due.</p>
  <p>To avoid any service interruption, please update your payment method as soon as possible.</p>
  <p><a href="${data.updatePaymentUrl}">Update Payment Method</a></p>
  <p>If you've already updated your payment information, please disregard this message.</p>
  <p>If you need assistance, please contact our support team at ${data.supportEmail}.</p>
  <p>Best regards,<br>${data.companyName}</p>
</body>
</html>
`;

export const serviceSuspensionWarningTemplate = (data: PaymentRecoveryTemplateData) => `
<!DOCTYPE html>
<html>
<body>
  <h1>Final Notice: Service Suspension Warning</h1>
  <p>Dear ${data.customerName},</p>
  <p>Your payment of ${formatCurrency(data.amount, data.currency)} for your ${data.planName} subscription is now ${data.daysPastDue} days past due.</p>
  <p><strong>Important:</strong> Your service will be suspended if payment is not received within the next 7 days.</p>
  <p>To prevent service interruption, please update your payment method immediately:</p>
  <p><a href="${data.updatePaymentUrl}">Update Payment Method</a></p>
  <p>If you need assistance or would like to discuss payment options, please contact our support team at ${data.supportEmail}.</p>
  <p>Best regards,<br>${data.companyName}</p>
</body>
</html>
`;

export const serviceSuspendedTemplate = (data: PaymentRecoveryTemplateData) => `
<!DOCTYPE html>
<html>
<body>
  <h1>Service Suspended Due to Non-Payment</h1>
  <p>Dear ${data.customerName},</p>
  <p>Due to continued non-payment, your ${data.planName} subscription has been suspended. The outstanding amount is ${formatCurrency(data.amount, data.currency)}.</p>
  <p>To restore your service, please update your payment method and settle the outstanding balance:</p>
  <p><a href="${data.updatePaymentUrl}">Update Payment Method</a></p>
  <p>If you need assistance or would like to discuss payment options, please contact our support team at ${data.supportEmail}.</p>
  <p>Best regards,<br>${data.companyName}</p>
</body>
</html>
`;