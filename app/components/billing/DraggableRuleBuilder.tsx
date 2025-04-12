import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { BillingRuleTemplate, defaultTemplates } from '@/app/billing/features/rule-builder/templates';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { CodeBlock } from '@/components/ui/code-block';
import { validateRule } from '@/app/billing/features/rule-builder/validation';

interface DraggableRuleBuilderProps {
  onSave: (rule: BillingRuleTemplate) => void;
}

export function DraggableRuleBuilder({ onSave }: DraggableRuleBuilderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<BillingRuleTemplate | null>(null);
  const [customizedRule, setCustomizedRule] = useState<BillingRuleTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Group templates by category
  const templatesByCategory = defaultTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, BillingRuleTemplate[]>);

  const handleTemplateSelect = (template: BillingRuleTemplate) => {
    setSelectedTemplate(template);
    setCustomizedRule({ ...template });
    setError(null);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || !customizedRule) return;

    const { source, destination, type } = result;

    // Handle condition reordering
    if (type === 'condition') {
      const conditions = Array.from(customizedRule.template.conditions);
      const [removed] = conditions.splice(source.index, 1);
      conditions.splice(destination.index, 0, removed);

      setCustomizedRule({
        ...customizedRule,
        template: {
          ...customizedRule.template,
          conditions,
        },
      });
    }

    // Handle action reordering
    if (type === 'action') {
      const actions = Array.from(customizedRule.template.actions);
      const [removed] = actions.splice(source.index, 1);
      actions.splice(destination.index, 0, removed);

      setCustomizedRule({
        ...customizedRule,
        template: {
          ...customizedRule.template,
          actions,
        },
      });
    }
  };

  const handleAddCondition = () => {
    if (!customizedRule) return;

    setCustomizedRule({
      ...customizedRule,
      template: {
        ...customizedRule.template,
        conditions: [
          ...customizedRule.template.conditions,
          {
            field: '',
            operator: 'equals',
            value: '',
          },
        ],
      },
    });
  };

  const handleAddAction = () => {
    if (!customizedRule) return;

    setCustomizedRule({
      ...customizedRule,
      template: {
        ...customizedRule.template,
        actions: [
          ...customizedRule.template.actions,
          {
            type: 'charge',
            params: {},
          },
        ],
      },
    });
  };

  const handleRemoveCondition = (index: number) => {
    if (!customizedRule) return;

    const conditions = [...customizedRule.template.conditions];
    conditions.splice(index, 1);

    setCustomizedRule({
      ...customizedRule,
      template: {
        ...customizedRule.template,
        conditions,
      },
    });
  };

  const handleRemoveAction = (index: number) => {
    if (!customizedRule) return;

    const actions = [...customizedRule.template.actions];
    actions.splice(index, 1);

    setCustomizedRule({
      ...customizedRule,
      template: {
        ...customizedRule.template,
        actions,
      },
    });
  };

  const handleRuleChange = (field: string, value: any) => {
    if (!customizedRule) return;

    let updatedRule: BillingRuleTemplate;

    if (field.startsWith('conditions.')) {
      const [_, index, subfield] = field.split('.');
      const newConditions = [...customizedRule.template.conditions];
      newConditions[parseInt(index)][subfield as keyof typeof newConditions[0]] = value;
      
      updatedRule = {
        ...customizedRule,
        template: {
          ...customizedRule.template,
          conditions: newConditions,
        },
      };
    } else if (field.startsWith('actions.')) {
      const [_, index, subfield] = field.split('.');
      const newActions = [...customizedRule.template.actions];
      newActions[parseInt(index)][subfield as keyof typeof newActions[0]] = value;
      
      updatedRule = {
        ...customizedRule,
        template: {
          ...customizedRule.template,
          actions: newActions,
        },
      };
    } else {
      updatedRule = {
        ...customizedRule,
        [field]: value,
      };
    }

    setCustomizedRule(updatedRule);

    // Validate the updated rule
    const errors = validateRule(updatedRule);
    const errorMap = errors.reduce((acc, error) => {
      acc[error.field] = error.message;
      return acc;
    }, {} as Record<string, string>);
    setValidationErrors(errorMap);
  };

  const generateRulePreview = () => {
    if (!customizedRule) return '';

    const conditions = customizedRule.template.conditions.map((condition) => {
      return `if (${condition.field} ${condition.operator} ${JSON.stringify(condition.value)})`;
    }).join(' && ');

    const actions = customizedRule.template.actions.map((action) => {
      return `${action.type}(${JSON.stringify(action.params)})`;
    }).join('\n');

    return `// ${customizedRule.name}
// ${customizedRule.description}

// Conditions
${conditions} {
  // Actions
  ${actions}
}`;
  };

  const handleSave = () => {
    if (!customizedRule) {
      setError('Please select a template first');
      return;
    }

    // Validate the rule
    const errors = validateRule(customizedRule);
    if (errors.length > 0) {
      const errorMap = errors.reduce((acc, error) => {
        acc[error.field] = error.message;
        return acc;
      }, {} as Record<string, string>);
      setValidationErrors(errorMap);
      setError('Please fix validation errors before saving');
      return;
    }

    onSave(customizedRule);
    setError(null);
    setValidationErrors({});
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {/* Template Selection */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Select a Template</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(templatesByCategory).map(([category, templates]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold capitalize">{category}</h3>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <h4 className="font-semibold">{template.name}</h4>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Rule Customization */}
        {customizedRule && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Customize Rule</h2>
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
            </div>

            {showPreview && (
              <Card className="mb-8 bg-gray-50">
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2">Rule Preview</h3>
                  <CodeBlock
                    language="javascript"
                    code={generateRulePreview()}
                    className="text-sm"
                  />
                </div>
              </Card>
            )}

            {/* Conditions */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Conditions</h3>
                <Button onClick={handleAddCondition}>Add Condition</Button>
              </div>

              <Droppable droppableId="conditions" type="condition">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-4"
                  >
                    {customizedRule.template.conditions.map((condition, index) => (
                      <Draggable
                        key={`condition-${index}`}
                        draggableId={`condition-${index}`}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="space-y-2"
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="flex items-center gap-4 bg-white p-4 border rounded-lg shadow-sm"
                            >
                              <div className="cursor-move">⋮⋮</div>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={condition.field}
                                  onChange={(e) =>
                                    handleRuleChange(`conditions.${index}.field`, e.target.value)
                                  }
                                  placeholder="Field"
                                  className={
                                    validationErrors[`conditions[${index}].field`]
                                      ? 'border-red-500'
                                      : ''
                                  }
                                />
                                {validationErrors[`conditions[${index}].field`] && (
                                  <p className="text-sm text-red-500">
                                    {validationErrors[`conditions[${index}].field`]}
                                  </p>
                                )}
                              </div>
                              <div className="w-40">
                                <Select
                                  value={condition.operator}
                                  onChange={(e) =>
                                    handleRuleChange(
                                      `conditions.${index}.operator`,
                                      e.target.value
                                    )
                                  }
                                  className={
                                    validationErrors[`conditions[${index}].operator`]
                                      ? 'border-red-500'
                                      : ''
                                  }
                                >
                                  <option value="equals">Equals</option>
                                  <option value="greater_than">Greater Than</option>
                                  <option value="less_than">Less Than</option>
                                  <option value="between">Between</option>
                                  <option value="contains">Contains</option>
                                </Select>
                                {validationErrors[`conditions[${index}].operator`] && (
                                  <p className="text-sm text-red-500">
                                    {validationErrors[`conditions[${index}].operator`]}
                                  </p>
                                )}
                              </div>
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={condition.value}
                                  onChange={(e) =>
                                    handleRuleChange(`conditions.${index}.value`, e.target.value)
                                  }
                                  placeholder="Value"
                                  className={
                                    validationErrors[`conditions[${index}].value`]
                                      ? 'border-red-500'
                                      : ''
                                  }
                                />
                                {validationErrors[`conditions[${index}].value`] && (
                                  <p className="text-sm text-red-500">
                                    {validationErrors[`conditions[${index}].value`]}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="destructive"
                                onClick={() => handleRemoveCondition(index)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Actions */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Actions</h3>
                <Button onClick={handleAddAction}>Add Action</Button>
              </div>

              <Droppable droppableId="actions" type="action">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-4"
                  >
                    {customizedRule.template.actions.map((action, index) => (
                      <Draggable
                        key={`action-${index}`}
                        draggableId={`action-${index}`}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-4 bg-white p-4 border rounded-lg shadow-sm"
                          >
                            <div {...provided.dragHandleProps} className="cursor-move">
                              ⋮⋮
                            </div>
                            <Select
                              value={action.type}
                              onChange={(e) =>
                                handleRuleChange(`actions.${index}.type`, e.target.value)
                              }
                              className="w-40"
                            >
                              <option value="charge">Charge</option>
                              <option value="discount">Discount</option>
                              <option value="notify">Notify</option>
                              <option value="limit">Limit</option>
                            </Select>
                            <Input
                              value={JSON.stringify(action.params)}
                              onChange={(e) => {
                                try {
                                  const params = JSON.parse(e.target.value);
                                  handleRuleChange(`actions.${index}.params`, params);
                                } catch (err) {
                                  // Invalid JSON, ignore
                                }
                              }}
                              placeholder="Parameters (JSON)"
                              className="flex-1"
                            />
                            <Button
                              variant="destructive"
                              onClick={() => handleRemoveAction(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                {error}
              </Alert>
            )}

            <Button onClick={handleSave} className="w-full">
              Save Rule
            </Button>
          </Card>
        )}
      </div>
    </DragDropContext>
  );
} 