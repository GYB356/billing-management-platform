import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline';
import Button from '@/components/common/Button';
import { saveDunningConfig } from '@/services/dunningService';

interface DunningStep {
  daysPastDue: number;
  action: 'email' | 'sms' | 'grace_period' | 'cancel';
  templateId?: string;
  message?: string;
  retryPayment: boolean;
}

interface DunningConfig {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  steps: DunningStep[];
}

interface DunningConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  config?: Partial<DunningConfig> | null;
}

const DunningConfigModal: React.FC<DunningConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  config = null,
}) => {
  const isEditing = !!config?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    isActive: false,
    steps: [] as DunningStep[],
  });

  useEffect(() => {
    if (config) {
      setForm({
        name: config.name || '',
        description: config.description || '',
        isActive: config.isActive || false,
        steps: config.steps || [],
      });
    } else {
      setForm({
        name: '',
        description: '',
        isActive: false,
        steps: [],
      });
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({ ...prev, [name]: checked }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddStep = () => {
    const newStep: DunningStep = {
      daysPastDue: form.steps.length > 0 
        ? Math.max(...form.steps.map(s => s.daysPastDue)) + 7
        : 1,
      action: 'email',
      retryPayment: true,
    };
    setForm(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
  };

  const handleRemoveStep = (index: number) => {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  const handleStepChange = (index: number, field: keyof DunningStep, value: any) => {
    setForm(prev => {
      const updatedSteps = [...prev.steps];
      updatedSteps[index] = {
        ...updatedSteps[index],
        [field]: value,
      };
      return {
        ...prev,
        steps: updatedSteps,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const sortedSteps = [...form.steps].sort((a, b) => a.daysPastDue - b.daysPastDue);
      if (!form.name.trim()) {
        throw new Error('Configuration name is required');
      }
      if (sortedSteps.length === 0) {
        throw new Error('At least one dunning step is required');
      }
      await saveDunningConfig({
        id: isEditing && config?.id ? config.id : undefined,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
        steps: sortedSteps,
      });
      onSave();
    } catch (err: any) {
      console.error('Error saving dunning config:', err);
      setError(err.message || 'Failed to save dunning configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'email':
        return 'Send Email';
      case 'sms':
        return 'Send SMS';
      case 'grace_period':
        return 'Grace Period';
      case 'cancel':
        return 'Cancel Subscription';
      default:
        return action;
    }
  };

  return (
    <Transition.Root show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" onClose={onClose}>
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>

          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <XIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900">
                    {isEditing ? 'Edit Dunning Configuration' : 'Create Dunning Configuration'}
                  </Dialog.Title>

                  {error && (
                    <div className="mt-2 rounded-md bg-red-50 p-4">
                      <div className="text-sm text-red-700">{error}</div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-4">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Configuration Name
                        </label>
                        <div className="mt-1">
                          <input
                            type="text"
                            name="name"
                            id="name"
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={form.name}
                            onChange={handleChange}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                          Description (Optional)
                        </label>
                        <div className="mt-1">
                          <textarea
                            name="description"
                            id="description"
                            rows={2}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={form.description}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="relative flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="isActive"
                            name="isActive"
                            type="checkbox"
                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            checked={form.isActive}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="isActive" className="font-medium text-gray-700">
                            Active Configuration
                          </label>
                          <p className="text-gray-500">
                            Only one configuration can be active at a time
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-gray-900">Dunning Steps</h4>
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={handleAddStep}
                          icon={<PlusIcon className="h-4 w-4 mr-1" />}
                        >
                          Add Step
                        </Button>
                      </div>

                      <div className="mt-2 space-y-4">
                        {form.steps.length === 0 ? (
                          <div className="text-center py-4 text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
                            No steps configured. Add a step to define your dunning sequence.
                          </div>
                        ) : (
                          form.steps.map((step, index) => (
                            <div key={index} className="border border-gray-200 rounded-md p-4">
                              <div className="flex justify-between items-center mb-3">
                                <h5 className="text-sm font-medium text-gray-900">
                                  Step {index + 1}
                                </h5>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStep(index)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <label htmlFor={`step-${index}-days`} className="block text-xs font-medium text-gray-700">
                                    Days Past Due
                                  </label>
                                  <div className="mt-1">
                                    <input
                                      type="number"
                                      id={`step-${index}-days`}
                                      min="1"
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-xs border-gray-300 rounded-md"
                                      value={step.daysPastDue}
                                      onChange={(e) => handleStepChange(index, 'daysPastDue', parseInt(e.target.value) || 1)}
                                      required
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label htmlFor={`step-${index}-action`} className="block text-xs font-medium text-gray-700">
                                    Action
                                  </label>
                                  <div className="mt-1">
                                    <select
                                      id={`step-${index}-action`}
                                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-xs border-gray-300 rounded-md"
                                      value={step.action}
                                      onChange={(e) => handleStepChange(index, 'action', e.target.value)}
                                      required
                                    >
                                      <option value="email">Send Email</option>
                                      <option value="sms">Send SMS</option>
                                      <option value="grace_period">Grace Period</option>
                                      <option value="cancel">Cancel Subscription</option>
                                    </select>
                                  </div>
                                </div>

                                {(step.action === 'email' || step.action === 'sms') && (
                                  <div>
                                    <label htmlFor={`step-${index}-message`} className="block text-xs font-medium text-gray-700">
                                      Message
                                    </label>
                                    <div className="mt-1">
                                      <textarea
                                        id={`step-${index}-message`}
                                        rows={3}
                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-xs border-gray-300 rounded-md"
                                        placeholder="Your payment of {{amount}} is past due. Please update your payment method."
                                        value={step.message || ''}
                                        onChange={(e) => handleStepChange(index, 'message', e.target.value)}
                                      />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                      Variables: {{customerName}}, {{amount}}, {{invoiceId}}
                                    </p>
                                  </div>
                                )}

                                <div className="relative flex items-start">
                                  <div className="flex items-center h-5">
                                    <input
                                      id={`step-${index}-retry`}
                                      type="checkbox"
                                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                      checked={step.retryPayment}
                                      onChange={(e) => handleStepChange(index, 'retryPayment', e.target.checked)}
                                    />
                                  </div>
                                  <div className="ml-3 text-xs">
                                    <label htmlFor={`step-${index}-retry`} className="font-medium text-gray-700">
                                      Retry Payment
                                    </label>
                                    <p className="text-gray-500">
                                      Attempt to charge the card again before executing this step
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-6 sm:flex sm:flex-row-reverse">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto sm:ml-3"
                      >
                        {isSubmitting ? 'Saving...' : 'Save Configuration'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full mt-3 sm:w-auto sm:mt-0"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default DunningConfigModal;