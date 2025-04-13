import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RuleComponent } from '@/app/billing/features/rule-builder/types';

interface Props {
  id: string;
  component: RuleComponent;
  onUpdate: (component: RuleComponent) => void;
}

export function SortableItem({ id, component, onUpdate }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1
  };

  const handleInputChange = (field: string, value: string) => {
    onUpdate({
      ...component,
      [field]: value
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 mb-4 rounded-lg border ${
        isDragging ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move p-2 hover:bg-gray-100 rounded"
        >
          ⋮⋮
        </div>
        <select
          value={component.type}
          onChange={(e) => handleInputChange('type', e.target.value)}
          className="ml-2 p-2 border rounded"
        >
          <option value="condition">Condition</option>
          <option value="action">Action</option>
          <option value="modifier">Modifier</option>
        </select>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={component.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Component Name"
        />

        <textarea
          value={component.logic}
          onChange={(e) => handleInputChange('logic', e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Component Logic"
          rows={3}
        />

        {component.type === 'condition' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={component.params?.threshold || ''}
              onChange={(e) =>
                handleInputChange('params', {
                  ...component.params,
                  threshold: e.target.value
                })
              }
              className="p-2 border rounded"
              placeholder="Threshold"
            />
            <select
              value={component.params?.operator || ''}
              onChange={(e) =>
                handleInputChange('params', {
                  ...component.params,
                  operator: e.target.value
                })
              }
              className="p-2 border rounded"
            >
              <option value="">Select Operator</option>
              <option value="gt">Greater Than</option>
              <option value="lt">Less Than</option>
              <option value="eq">Equals</option>
              <option value="gte">Greater Than or Equal</option>
              <option value="lte">Less Than or Equal</option>
            </select>
          </div>
        )}

        {component.type === 'action' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={component.params?.value || ''}
              onChange={(e) =>
                handleInputChange('params', {
                  ...component.params,
                  value: e.target.value
                })
              }
              className="p-2 border rounded"
              placeholder="Action Value"
            />
            <select
              value={component.params?.unit || ''}
              onChange={(e) =>
                handleInputChange('params', {
                  ...component.params,
                  unit: e.target.value
                })
              }
              className="p-2 border rounded"
            >
              <option value="">Select Unit</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
              <option value="multiplier">Multiplier</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
} 