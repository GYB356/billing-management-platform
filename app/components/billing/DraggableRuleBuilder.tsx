import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
import { BillingRuleTemplate, defaultTemplates } from '@/app/billing/features/rule-builder/templates';
import { validateRule } from '@/app/billing/features/rule-builder/validation';

interface Props {
  onSave: (rule: BillingRuleTemplate) => void;
  initialRule?: BillingRuleTemplate;
}

export function DraggableRuleBuilder({ onSave, initialRule }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<BillingRuleTemplate | null>(null);
  const [customizedRule, setCustomizedRule] = useState<BillingRuleTemplate | null>(initialRule || null);
  const [ruleComponents, setRuleComponents] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group templates by category
  const templatesByCategory = defaultTemplates.reduce((acc, template) => {
    const category = template.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, BillingRuleTemplate[]>);

  const handleTemplateSelect = (template: BillingRuleTemplate) => {
    setSelectedTemplate(template);
    setCustomizedRule({
      ...template,
      id: crypto.randomUUID(),
      components: [...template.components]
    });
    setRuleComponents(template.components.map(c => c.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRuleComponents((items) => {
        const oldIndex = items.indexOf(active.id.toString());
        const newIndex = items.indexOf(over.id.toString());
        
        return arrayMove(items, oldIndex, newIndex);
      });

      if (customizedRule) {
        const newComponents = arrayMove(
          customizedRule.components,
          customizedRule.components.findIndex(c => c.id === active.id),
          customizedRule.components.findIndex(c => c.id === over.id)
        );

        setCustomizedRule({
          ...customizedRule,
          components: newComponents
        });
      }
    }
  };

  const handleSave = () => {
    if (!customizedRule) return;

    const isValid = validateRule(customizedRule);
    if (!isValid) {
      alert('Please ensure all rule components are properly configured');
      return;
    }

    onSave(customizedRule);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-6">Billing Rule Builder</h1>
      
      <div className="grid grid-cols-3 gap-6">
        {/* Templates Panel */}
        <div className="col-span-1 border-r pr-6">
          <h2 className="text-xl font-semibold mb-4">Templates</h2>
          {Object.entries(templatesByCategory).map(([category, templates]) => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold capitalize">{category}</h3>
              <div className="space-y-2 mt-2">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`w-full p-3 text-left rounded-lg transition ${
                      selectedTemplate?.id === template.id
                        ? 'bg-blue-100 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-gray-600">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Rule Builder Panel */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold mb-4">Rule Configuration</h2>
          
          {customizedRule ? (
            <>
              <div className="mb-6">
                <input
                  type="text"
                  value={customizedRule.name}
                  onChange={(e) => setCustomizedRule({
                    ...customizedRule,
                    name: e.target.value
                  })}
                  className="w-full p-2 border rounded"
                  placeholder="Rule Name"
                />
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={ruleComponents}
                  strategy={verticalListSortingStrategy}
                >
                  {customizedRule.components.map((component) => (
                    <SortableItem
                      key={component.id}
                      id={component.id}
                      component={component}
                      onUpdate={(updated) => {
                        const newComponents = customizedRule.components.map(c =>
                          c.id === updated.id ? updated : c
                        );
                        setCustomizedRule({
                          ...customizedRule,
                          components: newComponents
                        });
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <div className="mt-6">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save Rule
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Select a template to start building your rule
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 