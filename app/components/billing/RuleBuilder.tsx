import React, { useState } from 'react';
import { BillingRuleTemplate, defaultTemplates } from '@/app/billing/features/rule-builder/templates';

interface RuleBuilderProps {
  onSave: (rule: BillingRuleTemplate) => void;
}

export default function RuleBuilder({ onSave }: RuleBuilderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<BillingRuleTemplate | null>(null);
  const [customizedRule, setCustomizedRule] = useState<BillingRuleTemplate | null>(null);

  const handleTemplateSelect = (template: BillingRuleTemplate) => {
    setSelectedTemplate(template);
    setCustomizedRule({ ...template });
  };

  const handleRuleChange = (field: string, value: any) => {
    if (!customizedRule) return;

    if (field.startsWith('conditions.')) {
      const [_, index, subfield] = field.split('.');
      const newConditions = [...customizedRule.template.conditions];
      newConditions[parseInt(index)][subfield as keyof typeof newConditions[0]] = value;
      
      setCustomizedRule({
        ...customizedRule,
        template: {
          ...customizedRule.template,
          conditions: newConditions,
        },
      });
    } else if (field.startsWith('actions.')) {
      const [_, index, subfield] = field.split('.');
      const newActions = [...customizedRule.template.actions];
      newActions[parseInt(index)][subfield as keyof typeof newActions[0]] = value;
      
      setCustomizedRule({
        ...customizedRule,
        template: {
          ...customizedRule.template,
          actions: newActions,
        },
      });
    } else {
      setCustomizedRule({
        ...customizedRule,
        [field]: value,
      });
    }
  };

  const handleSave = () => {
    if (customizedRule) {
      onSave(customizedRule);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Billing Rule Builder</h2>
      
      {/* Template Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Select a Template</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {defaultTemplates.map((template) => (
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
              <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 rounded">
                {template.category}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rule Customization */}
      {customizedRule && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Customize Rule</h3>
          
          {/* Conditions */}
          <div className="mb-6">
            <h4 className="font-medium mb-2">Conditions</h4>
            {customizedRule.template.conditions.map((condition, index) => (
              <div key={index} className="flex gap-4 mb-2">
                <input
                  type="text"
                  value={condition.field}
                  onChange={(e) => handleRuleChange(`conditions.${index}.field`, e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Field"
                />
                <select
                  value={condition.operator}
                  onChange={(e) => handleRuleChange(`conditions.${index}.operator`, e.target.value)}
                  className="p-2 border rounded"
                >
                  <option value="equals">Equals</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="between">Between</option>
                  <option value="contains">Contains</option>
                </select>
                <input
                  type="text"
                  value={condition.value}
                  onChange={(e) => handleRuleChange(`conditions.${index}.value`, e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Value"
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mb-6">
            <h4 className="font-medium mb-2">Actions</h4>
            {customizedRule.template.actions.map((action, index) => (
              <div key={index} className="flex gap-4 mb-2">
                <select
                  value={action.type}
                  onChange={(e) => handleRuleChange(`actions.${index}.type`, e.target.value)}
                  className="p-2 border rounded"
                >
                  <option value="charge">Charge</option>
                  <option value="discount">Discount</option>
                  <option value="notify">Notify</option>
                  <option value="limit">Limit</option>
                </select>
                <input
                  type="text"
                  value={JSON.stringify(action.params)}
                  onChange={(e) => handleRuleChange(`actions.${index}.params`, JSON.parse(e.target.value))}
                  className="flex-1 p-2 border rounded"
                  placeholder="Parameters (JSON)"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Save Rule
          </button>
        </div>
      )}
    </div>
  );
} 