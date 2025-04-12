import { render, screen, fireEvent } from '@testing-library/react';
import RuleBuilder from '@/app/components/billing/RuleBuilder';
import { defaultTemplates } from '@/app/billing/features/rule-builder/templates';

describe('RuleBuilder', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it('renders all available templates', () => {
    render(<RuleBuilder onSave={mockOnSave} />);
    
    defaultTemplates.forEach((template) => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
      expect(screen.getByText(template.description)).toBeInTheDocument();
    });
  });

  it('allows template selection', () => {
    render(<RuleBuilder onSave={mockOnSave} />);
    
    const firstTemplate = defaultTemplates[0];
    const templateElement = screen.getByText(firstTemplate.name);
    
    fireEvent.click(templateElement);
    
    expect(screen.getByText('Customize Rule')).toBeInTheDocument();
  });

  it('allows condition customization', () => {
    render(<RuleBuilder onSave={mockOnSave} />);
    
    // Select first template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));
    
    // Find condition inputs
    const fieldInput = screen.getByPlaceholderText('Field');
    const valueInput = screen.getByPlaceholderText('Value');
    
    // Modify condition
    fireEvent.change(fieldInput, { target: { value: 'new_field' } });
    fireEvent.change(valueInput, { target: { value: '100' } });
    
    // Save changes
    fireEvent.click(screen.getByText('Save Rule'));
    
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          conditions: expect.arrayContaining([
            expect.objectContaining({
              field: 'new_field',
              value: '100'
            })
          ])
        })
      })
    );
  });

  it('allows action customization', () => {
    render(<RuleBuilder onSave={mockOnSave} />);
    
    // Select first template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));
    
    // Find action inputs
    const actionTypeSelect = screen.getByRole('combobox');
    const paramsInput = screen.getByPlaceholderText('Parameters (JSON)');
    
    // Modify action
    fireEvent.change(actionTypeSelect, { target: { value: 'discount' } });
    fireEvent.change(paramsInput, { 
      target: { 
        value: JSON.stringify({
          amount: 10,
          type: 'percentage'
        })
      } 
    });
    
    // Save changes
    fireEvent.click(screen.getByText('Save Rule'));
    
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              type: 'discount',
              params: {
                amount: 10,
                type: 'percentage'
              }
            })
          ])
        })
      })
    );
  });
}); 