'use client';

import { useI18n } from '@/components/i18n/I18nProvider';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceSummaryProps {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  currency: string;
  totalAmount: number;
  taxAmount: number;
  status: 'paid' | 'pending' | 'overdue';
}

export function InvoiceSummary({
  invoiceNumber,
  issueDate,
  dueDate,
  items,
  currency,
  totalAmount,
  taxAmount,
  status,
}: InvoiceSummaryProps) {
  const { t, formatDate, formatCurrency } = useI18n();

  // Get status display text and color based on status
  const getStatusDisplay = () => {
    const statusMap = {
      paid: { text: t('invoice.status.paid'), color: 'text-green-600 bg-green-50' },
      pending: { text: t('invoice.status.pending'), color: 'text-yellow-600 bg-yellow-50' },
      overdue: { text: t('invoice.status.overdue'), color: 'text-red-600 bg-red-50' },
    };
    return statusMap[status];
  };

  const statusDisplay = getStatusDisplay();
  const subtotal = totalAmount - taxAmount;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            {t('invoice.title', { number: invoiceNumber })}
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusDisplay.color}`}>
            {statusDisplay.text}
          </span>
        </div>
      </div>
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">{t('invoice.issueDate')}</p>
            <p className="text-sm font-medium">{formatDate(issueDate, 'long')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('invoice.dueDate')}</p>
            <p className="text-sm font-medium">{formatDate(dueDate, 'long')}</p>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-4 mt-2">
          <h3 className="text-sm font-medium mb-2">{t('invoice.items')}</h3>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-gray-500">{t('invoice.quantity', { count: item.quantity })}</p>
                </div>
                <p className="font-medium">
                  {formatCurrency(item.quantity * item.unitPrice, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex justify-between text-sm mb-2">
            <p className="text-gray-500">{t('invoice.subtotal')}</p>
            <p className="font-medium">{formatCurrency(subtotal, currency)}</p>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <p className="text-gray-500">{t('invoice.tax')}</p>
            <p className="font-medium">{formatCurrency(taxAmount, currency)}</p>
          </div>
          <div className="flex justify-between text-base font-medium mt-3">
            <p>{t('invoice.total')}</p>
            <p>{formatCurrency(totalAmount, currency)}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 