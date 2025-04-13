import React, { useState } from 'react';

// Rule templates
const RULE_TEMPLATES = [
  {
    id: 'volume-discount',
    name: 'Volume Discount',
    description: 'Apply discounts based on usage volume',
    icon: '📊',
    rule: {
      type: 'discount',
      conditions: [
        { metric: 'api_calls', operator: 'gt', value: 1000 }
      ],
      actions: [
        { type: 'percentage_discount', value: 10 }
      ]
    }
  },
  {
    id: 'tiered-pricing',
    name: 'Tiered Pricing',
    description: 'Charge different rates based on usage tiers',
    icon: '💰',
    rule: {
      type: 'pricing',
      conditions: [
        { metric: 'storage_gb', operator: 'between', min: 0, max: 100 }
      ],
      actions: [
        { type: 'set_price', value: 0.05, unit: 'per_gb' }
      ]
    }
  },
  {
    id: 'promotional',
    name: 'Promotional Offer',
    description: 'Limited-time discount for new customers',
    icon: '🎁',
    rule: {
      type: 'discount',
      conditions: [
        { metric: 'customer_age_days', operator: 'lt', value: 30 }
      ],
      actions: [
        { type: 'percentage_discount', value: 20 }
      ]
    }
  },
  {
    id: 'usage-cap',
    name: 'Usage Cap',
    description: 'Set maximum usage limits',
    icon: '⚠️',
    rule: {
      type: 'cap',
      conditions: [
        { metric: 'plan', operator: 'eq', value: 'free' }
      ],
      actions: [
        { type: 'limit', metric: 'api_calls', value: 10000 }
      ]
    }
  },
];

// Available metrics
const AVAILABLE_METRICS = [
  { id: 'api_calls', name: 'API Calls', units: 'calls' },
  { id: 'storage_gb', name: 'Storage', units: 'GB' },
  { id: 'users', name: 'User Seats', units: 'users' },
  { id: 'customer_age_days', name: 'Customer Age', units: 'days' },
  { id: 'plan', name: 'Plan', units: '' },
];

// Operator options
const OPERATORS = [
  { id: 'eq', name: 'Equals' },
  { id: 'gt', name: 'Greater Than' },
  { id: 'lt', name: 'Less Than' },
  { id: 'gte', name: 'Greater Than or Equal' },
  { id: 'lte', name: 'Less Than or Equal' },
  { id: 'between', name: 'Between' },
];

// Action types
const ACTION_TYPES = [
  { id: 'percentage_discount', name: 'Percentage Discount' },
  { id: 'fixed_discount', name: 'Fixed Discount' },
  { id: 'set_price', name: 'Set Price' },
  { id: 'limit', name: 'Set Usage Limit' },
];

interface RuleBuilderProps {
  onSave: (rule: any) => void;
}

export default function SimpleRuleBuilder({ onSave }: RuleBuilderProps) {
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [rule, setRule] = useState({
    name: '',
    description: '',
    type: 'discount',
    conditions: [{ metric: 'api_calls', operator: 'gt', value: 1000 }],
    actions: [{ type: 'percentage_discount', value: 10 }],
  });

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setRule({
      name: template.name,
      description: template.description,
      type: template.rule.type,
      conditions: [...template.rule.conditions],
      actions: [...template.rule.actions],
    });
    
    // Switch to builder tab after selecting template
    setActiveTab('builder');
  };

  // Update rule name
  const updateRuleName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRule({...rule, name: e.target.value});
  };

  // Update rule description
  const updateRuleDescription = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRule({...rule, description: e.target.value});
  };

  // Update rule type
  const updateRuleType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRule({...rule, type: e.target.value});
  };

  // Update condition
  const updateCondition = (index: number, field: string, value: any) => {
    const updatedConditions = [...rule.conditions];
    updatedConditions[index] = {...updatedConditions[index], [field]: value};
    setRule({...rule, conditions: updatedConditions});
  };

  // Add condition
  const addCondition = () => {
    setRule({
      ...rule,
      conditions: [...rule.conditions, { metric: 'api_calls', operator: 'gt', value: 1000 }]
    });
  };

  // Remove condition
  const removeCondition = (index: number) => {
    const updatedConditions = rule.conditions.filter((_, i) => i !== index);
    setRule({...rule, conditions: updatedConditions});
  };

  // Update action
  const updateAction = (index: number, field: string, value: any) => {
    const updatedActions = [...rule.actions];
    updatedActions[index] = {...updatedActions[index], [field]: value};
    setRule({...rule, actions: updatedActions});
  };

  // Add action
  const addAction = () => {
    setRule({
      ...rule,
      actions: [...rule.actions, { type: 'percentage_discount', value: 10 }]
    });
  };

  // Remove action
  const removeAction = (index: number) => {
    const updatedActions = rule.actions.filter((_, i) => i !== index);
    setRule({...rule, actions: updatedActions});
  };

  // Handle save
  const handleSave = () => {
    onSave(rule);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Billing Rule Builder</h1>
      
      {/* Tabs */}
      <div className="border-b mb-4">
        <div className="flex">
          <button
            className={`py-2 px-4 ${activeTab === 'templates' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
          <button
            className={`py-2 px-4 ${activeTab === 'builder' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            Rule Builder
          </button>
          <button
            className={`py-2 px-4 ${activeTab === 'preview' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
        </div>
      </div>
      
      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RULE_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer hover:border-blue-500 ${
                selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => applyTemplate(template.id)}
            >
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-2">{template.icon}</span>
                <h3 className="text-lg font-medium">{template.name}</h3>
              </div>
              <p className="text-gray-600 mb-3">{template.description}</p>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  applyTemplate(template.id);
                }}
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Builder Tab */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                value={rule.name}
                onChange={updateRuleName}
                placeholder="e.g. Volume Discount"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Type
              </label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={rule.type}
                onChange={updateRuleType}
              >
                <option value="discount">Discount</option>
                <option value="pricing">Pricing</option>
                <option value="cap">Usage Cap</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md"
              value={rule.description}
              onChange={updateRuleDescription}
              placeholder="Brief description of this rule"
            />
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Conditions</h3>
            <p className="text-sm text-gray-600 mb-4">
              Define when this rule should apply
            </p>
            
            {rule.conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2 mb-4">
                <select
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={condition.metric}
                  onChange={(e) => updateCondition(index, 'metric', e.target.value)}
                >
                  {AVAILABLE_METRICS.map((metric) => (
                    <option key={metric.id} value={metric.id}>
                      {metric.name}
                    </option>
                  ))}
                </select>
                
                <select
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
                </select>
                
                {condition.operator !== 'between' ? (
                  <input
                    type="number"
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, 'value', parseFloat(e.target.value))}
                    placeholder="Value"
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      className="flex-1 px-3 py-2 border rounded-md"
                      value={condition.min}
                      onChange={(e) => updateCondition(index, 'min', parseFloat(e.target.value))}
                      placeholder="Min"
                    />
                    <input
                      type="number"
                      className="flex-1 px-3 py-2 border rounded-md"
                      value={condition.max}
                      onChange={(e) => updateCondition(index, 'max', parseFloat(e.target.value))}
                      placeholder="Max"
                    />
                  </>
                )}
                
                <button
                  className="px-3 py-2 border rounded-md bg-red-50 text-red-500"
                  onClick={() => removeCondition(index)}
                >
                  X
                </button>
              </div>
            ))}
            
            <button
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
              onClick={addCondition}
            >
              Add Condition
            </button>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Actions</h3>
            <p className="text-sm text-gray-600 mb-4">
              Define what happens when conditions are met
            </p>
            
            {rule.actions.map((action, index) => (
              <div key={index} className="flex items-center gap-2 mb-4">
                <select
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={action.type}
                  onChange={(e) => updateAction(index, 'type', e.target.value)}
                >
                  {ACTION_TYPES.map((actionType) => (
                    <option key={actionType.id} value={actionType.id}>
                      {actionType.name}
                    </option>
                  ))}
                </select>
                
                <input
                  type="number"
                  className="flex-1 px-3 py-2 border rounded-md"
                  value={action.value}
                  onChange={(e) => updateAction(index, 'value', parseFloat(e.target.value))}
                  placeholder="Value"
                />
                
                {action.type === 'set_price' && (
                  <select
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={action.unit}
                    onChange={(e) => updateAction(index, 'unit', e.target.value)}
                  >
                    <option value="per_unit">Per Unit</option>
                    <option value="per_gb">Per GB</option>
                    <option value="per_1000">Per 1000</option>
                    <option value="flat">Flat Rate</option>
                  </select>
                )}
                
                {action.type === 'limit' && (
                  <select
                    className="flex-1 px-3 py-2 border rounded-md"
                    value={action.metric}
                    onChange={(e) => updateAction(index, 'metric', e.target.value)}
                  >
                    {AVAILABLE_METRICS.map((metric) => (
                      <option key={metric.id} value={metric.id}>
                        {metric.name}
                      </option>
                    ))}
                  </select>
                )}
                
                <button
                  className="px-3 py-2 border rounded-md bg-red-50 text-red-500"
                  onClick={() => removeAction(index)}
                >
                  X
                </button>
              </div>
            ))}
            
            <button
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
              onClick={addAction}
            >
              Add Action
            </button>
          </div>
          
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            onClick={handleSave}
          >
            Save Rule
          </button>
        </div>
      )}
      
      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">{rule.name || 'Unnamed Rule'}</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-medium">Description</h3>
              <p className="text-gray-600">{rule.description || 'No description provided'}</p>
            </div>
            
            <div>
              <h3 className="text-md font-medium">Type</h3>
              <p className="text-gray-600 capitalize">{rule.type}</p>
            </div>
            
            <div>
              <h3 className="text-md font-medium">Conditions</h3>
              <ul className="list-disc list-inside text-gray-600">
                {rule.conditions.map((condition, index) => {
                  const metric = AVAILABLE_METRICS.find(m => m.id === condition.metric);
                  const operator = OPERATORS.find(o => o.id === condition.operator);
                  
                  return (
                    <li key={index}>
                      {metric?.name || condition.metric} {operator?.name || condition.operator}{' '}
                      {condition.operator === 'between'
                        ? `${condition.min} and ${condition.max}`
                        : condition.value}
                      {metric?.units ? ` ${metric.units}` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div>
              <h3 className="text-md font-medium">Actions</h3>
              <ul className="list-disc list-inside text-gray-600">
                {rule.actions.map((action, index) => {
                  const actionType = ACTION_TYPES.find(a => a.id === action.type);
                  
                  let description = `${actionType?.name || action.type}: ${action.value}`;
                  
                  if (action.type === 'percentage_discount') {
                    description += '%';
                  } else if (action.type === 'set_price') {
                    description += ` (${action.unit})`;
                  } else if (action.type === 'limit') {
                    const metric = AVAILABLE_METRICS.find(m => m.id === action.metric);
                    description += ` ${metric?.name || action.metric}`;
                  }
                  
                  return <li key={index}>{description}</li>;
                })}
              </ul>
            </div>
          </div>
          
          <div className="mt-6">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 mr-2"
              onClick={() => setActiveTab('builder')}
            >
              Edit Rule
            </button>
            <button
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              onClick={handleSave}
            >
              Save Rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}