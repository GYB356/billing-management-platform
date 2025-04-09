import { render, screen, fireEvent } from '@testing-library/react';
import { BillingForm } from '@/components/billing/BillingForm';
import { PaymentModal } from '@/components/billing/PaymentModal';

describe('Billing Components', () => {
  test('BillingForm renders correctly', () => {
    render(<BillingForm />);
    expect(screen.getByText('Payment Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Card Number')).toBeInTheDocument();
  });

  test('PaymentModal handles submission', async () => {
    const mockSubmit = jest.fn();
    render(<PaymentModal onSubmit={mockSubmit} />);
    
    fireEvent.click(screen.getByText('Confirm Payment'));
    expect(mockSubmit).toHaveBeenCalled();
  });
});
