import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaxRateForm } from '@/components/tax/TaxRateForm';

describe('TaxRateForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders the form with empty fields when no initial data is provided', () => {
    render(<TaxRateForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByLabelText(/rate/i)).toHaveValue('0');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('renders the form with initial data when provided', () => {
    const initialData = {
      name: 'Test Tax',
      rate: 10,
      description: 'Test Description',
      isActive: true,
    };

    render(<TaxRateForm initialData={initialData} onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('Test Tax');
    expect(screen.getByLabelText(/rate/i)).toHaveValue('10');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Test Description');
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('submits form data when all required fields are filled', async () => {
    render(<TaxRateForm onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Tax' },
    });
    fireEvent.change(screen.getByLabelText(/rate/i), {
      target: { value: '10' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save tax rate/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Tax',
        rate: 10,
        description: '',
        isActive: true,
      });
    });
  });

  it('shows validation errors for required fields', async () => {
    render(<TaxRateForm onSubmit={mockOnSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /save tax rate/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/rate must be between 0 and 100/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('disables the submit button while loading', () => {
    render(<TaxRateForm onSubmit={mockOnSubmit} isLoading={true} />);

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});