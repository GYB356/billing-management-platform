import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Rule templates
const RULE_TEMPLATES = [
  {
    id: 'volume-discount',
    name: 'Volume Discount',
    description: 'Apply discounts based on usage volume',
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

// Metrics that can be used in rules
const AVAILABLE_METRICS = [
  { id: 'api_calls', name: 'API Calls', units: 'calls' },
  { id: 'storage_gb', name: 'Storage', units: 'GB' },
  { id: 'users', name: 'User Seats', units: 'users' },
  { id: 'customer_age_days', name: 'Customer Age', units: 'days' },
  { id: 'plan', name: 'Plan', units: '' },
];

// Operators for conditions
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

// Form schema
const formSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().optional(),
  type: z.enum(['discount', 'pricing', 'cap']),
  conditions: z.array(
    z.object({
      metric: z.string(),
      operator: z.string(),
      value: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
  ),
  actions: z.array(
    z.object({
      type: z.string(),
      value: z.number(),
      unit: z.string().optional(),
      metric: z.string().optional(),
    })
  ),
});

type RuleFormValues = z.infer<typeof formSchema>;

interface RuleBuilderProps {
  onSave: (rule: RuleFormValues) => void;
}

export default function RuleBuilder({ onSave }: RuleBuilderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // Initialize form
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'discount',
      conditions: [{ metric: 'api_calls', operator: 'gt', value: 0 }],
      actions: [{ type: 'percentage_discount', value: 0 }],
    },
  });

  // Apply template
  const applyTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    
    form.reset({
      name: template.name,
      description: template.description,
      type: template.rule.type,
      conditions: template.rule.conditions,
      actions: template.rule.actions,
    });
  };

  // Add condition
  const addCondition = () => {
    const currentConditions = form.getValues().conditions || [];
    form.setValue('conditions', [
      ...currentConditions,
      { metric: 'api_calls', operator: 'gt', value: 0 }
    ]);
  };

  // Remove condition
  const removeCondition = (index: number) => {
    const currentConditions = form.getValues().conditions || [];
    form.setValue('conditions', 
      currentConditions.filter((_, i) => i !== index)
    );
  };

  // Add action
  const addAction = () => {
    const currentActions = form.getValues().actions || [];
    form.setValue('actions', [
      ...currentActions,
      { type: 'percentage_discount', value: 0 }
    ]);
  };

  // Remove action
  const removeAction = (index: number) => {
    const currentActions = form.getValues().actions || [];
    form.setValue('actions', 
      currentActions.filter((_, i) => i !== index)
    );
  };

  // Submit handler
  const onSubmit = (data: RuleFormValues) => {
    onSave(data);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Billing Rule Builder</h1>
      
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="builder">Rule Builder</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {RULE_TEMPLATES.map((template) => (
              <Card 
              key={template.id}
                className={`cursor-pointer hover:border-primary ${
                  selectedTemplate === template.id ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => applyTemplate(template.id)}
              >
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      applyTemplate(template.id);
                    }}
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
          ))}
        </div>
        </TabsContent>
        
        {/* Builder Tab */}
        <TabsContent value="builder">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Volume Discount" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a rule type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="discount">Discount</SelectItem>
                          <SelectItem value="pricing">Pricing</SelectItem>
                          <SelectItem value="cap">Usage Cap</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of this rule" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div>
                <h3 className="text-lg font-medium mb-2">Conditions</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Define when this rule should apply
                </p>
                
                {form.watch('conditions')?.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 mb-4">
                    <FormField
                      control={form.control}
                      name={`conditions.${index}.metric`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select metric" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {AVAILABLE_METRICS.map((metric) => (
                                <SelectItem key={metric.id} value={metric.id}>
                                  {metric.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`conditions.${index}.operator`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select operator" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OPERATORS.map((op) => (
                                <SelectItem key={op.id} value={op.id}>
                                  {op.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    
                    {condition.operator !== 'between' ? (
                      <FormField
                        control={form.control}
                        name={`conditions.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Value"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ) : (
                      <>
                        <FormField
                          control={form.control}
                          name={`conditions.${index}.min`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Min"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`conditions.${index}.max`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Max"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeCondition(index)}
                    >
                      X
                    </Button>
              </div>
            ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCondition}
                >
                  Add Condition
                </Button>
          </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Actions</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Define what happens when conditions are met
                </p>
                
                {form.watch('actions')?.map((action, index) => (
                  <div key={index} className="flex items-center gap-2 mb-4">
                    <FormField
                      control={form.control}
                      name={`actions.${index}.type`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select action type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ACTION_TYPES.map((actionType) => (
                                <SelectItem key={actionType.id} value={actionType.id}>
                                  {actionType.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`actions.${index}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Value"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {action.type === 'set_price' && (
                      <FormField
                        control={form.control}
                        name={`actions.${index}.unit`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="per_unit">Per Unit</SelectItem>
                                <SelectItem value="per_gb">Per GB</SelectItem>
                                <SelectItem value="per_1000">Per 1000</SelectItem>
                                <SelectItem value="flat">Flat Rate</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}
                    
                    {action.type === 'limit' && (
                      <FormField
                        control={form.control}
                        name={`actions.${index}.metric`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select metric" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {AVAILABLE_METRICS.map((metric) => (
                                  <SelectItem key={metric.id} value={metric.id}>
                                    {metric.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeAction(index)}
                    >
                      X
                    </Button>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAction}
                >
                  Add Action
                </Button>
              </div>
              
              <Button type="submit">Save Rule</Button>
            </form>
          </Form>
        </TabsContent>
        
        {/* Preview Tab */}
        <TabsContent value="preview">
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Rule Preview</h3>
            <Card>
              <CardHeader>
                <CardTitle>{form.watch('name') || 'Unnamed Rule'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Description</h4>
                    <p className="text-sm text-gray-600">
                      {form.watch('description') || 'No description provided'}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium">Type</h4>
                    <p className="text-sm text-gray-600 capitalize">
                      {form.watch('type')}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium">Conditions</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {form.watch('conditions')?.map((condition, index) => {
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
                    <h4 className="font-medium">Actions</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {form.watch('actions')?.map((action, index) => {
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
              </CardContent>
            </Card>
        </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 