import { render, screen, fireEvent } from '@testing-library/react';
import { DragDropContext } from 'react-beautiful-dnd';
import { DraggableRuleBuilder } from '@/app/components/billing/DraggableRuleBuilder';
import { defaultTemplates } from '@/app/billing/features/rule-builder/templates';

// Mock react-beautiful-dnd
jest.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => children,
  Droppable: ({ children }: { children: Function }) =>
    children({
      draggableProps: {
        style: {},
      },
      innerRef: jest.fn(),
    }),
  Draggable: ({ children }: { children: Function }) =>
    children({
      draggableProps: {
        style: {},
      },
      innerRef: jest.fn(),
      dragHandleProps: {},
    }),
}));

describe('DraggableRuleBuilder', () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it('renders templates grouped by category', () => {
    render(<DraggableRuleBuilder onSave={mockOnSave} />);

    // Get unique categories
    const categories = [...new Set(defaultTemplates.map((t) => t.category))];

    // Check if each category is rendered
    categories.forEach((category) => {
      expect(screen.getByText(category, { exact: false })).toBeInTheDocument();
    });

    // Check if all templates are rendered
    defaultTemplates.forEach((template) => {
      expect(screen.getByText(template.name)).toBeInTheDocument();
      expect(screen.getByText(template.description)).toBeInTheDocument();
    });
  });

  it('allows template selection and shows customization interface', () => {
    render(<DraggableRuleBuilder onSave={mockOnSave} />);

    // Select a template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));

    // Check if customization interface appears
    expect(screen.getByText('Customize Rule')).toBeInTheDocument();
    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('allows adding and removing conditions', () => {
    render(<DraggableRuleBuilder onSave={mockOnSave} />);

    // Select a template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));

    // Get initial number of conditions
    const initialConditions = screen.getAllByPlaceholderText('Field').length;

    // Add a condition
    fireEvent.click(screen.getByText('Add Condition'));
    expect(screen.getAllByPlaceholderText('Field')).toHaveLength(initialConditions + 1);

    // Remove a condition
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText('Field')).toHaveLength(initialConditions);
  });

  it('allows adding and removing actions', () => {
    render(<DraggableRuleBuilder onSave={mockOnSave} />);

    // Select a template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));

    // Get initial number of actions
    const initialActions = screen.getAllByPlaceholderText('Parameters (JSON)').length;

    // Add an action
    fireEvent.click(screen.getByText('Add Action'));
    expect(screen.getAllByPlaceholderText('Parameters (JSON)')).toHaveLength(
      initialActions + 1
    );

    // Remove an action
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.getAllByPlaceholderText('Parameters (JSON)')).toHaveLength(
      initialActions
    );
  });

  it('validates rule before saving', () => {
    render(<DraggableRuleBuilder onSave={mockOnSave} />);

    // Select a template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));

    // Try to save without filling required fields
    fireEvent.click(screen.getByText('Save Rule'));

    // Check for validation error
    expect(screen.getByText(/conditions must have/i)).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('saves valid rule', () => {
    render(<DraggableRuleBuilder onSave={mockOnSave} />);

    // Select a template
    const firstTemplate = defaultTemplates[0];
    fireEvent.click(screen.getByText(firstTemplate.name));

    // Fill in condition
    const fieldInput = screen.getAllByPlaceholderText('Field')[0];
    const valueInput = screen.getAllByPlaceholderText('Value')[0];
    fireEvent.change(fieldInput, { target: { value: 'test_field' } });
    fireEvent.change(valueInput, { target: { value: 'test_value' } });

    // Fill in action
    const paramsInput = screen.getAllByPlaceholderText('Parameters (JSON)')[0];
    fireEvent.change(paramsInput, {
      target: { value: JSON.stringify({ amount: 10 }) },
    });

    // Save the rule
    fireEvent.click(screen.getByText('Save Rule'));

    // Check if onSave was called with the correct data
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          conditions: expect.arrayContaining([
            expect.objectContaining({
              field: 'test_field',
              value: 'test_value',
            }),
          ]),
          actions: expect.arrayContaining([
            expect.objectContaining({
              params: { amount: 10 },
            }),
          ]),
        }),
      })
    );
  });
}); 