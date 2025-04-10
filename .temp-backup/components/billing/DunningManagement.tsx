import React, { useState } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, ExclamationCircleIcon } from '@heroicons/react/outline';
import { BadgeCheckIcon, SortAscendingIcon } from '@heroicons/react/solid';
import { useDunningConfigs } from '@/hooks/useDunningConfigs';
import { deleteDunningConfig } from '@/services/dunningService';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';
import DunningConfigModal from './DunningConfigModal';
import ConfirmationModal from '@/components/common/ConfirmationModal';

const DunningManagement: React.FC = () => {
  const { configs, isLoading, error, mutate } = useDunningConfigs();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [configToDelete, setConfigToDelete] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const handleCreateConfig = () => {
    setEditingConfig(null);
    setShowConfigModal(true);
  };

  const handleEditConfig = (config: any) => {
    setEditingConfig(config);
    setShowConfigModal(true);
  };

  const handleDeleteClick = (config: any) => {
    setConfigToDelete(config);
  };

  const handleDeleteConfirm = async () => {
    if (!configToDelete) return;

    setIsProcessing(true);
    setProcessingError(null);

    try {
      await deleteDunningConfig(configToDelete.id);
      setConfigToDelete(null);
      await mutate();
    } catch (error: any) {
      console.error('Error deleting dunning config:', error);
      setProcessingError(error.message || 'Failed to delete dunning configuration');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfigSaved = async () => {
    setShowConfigModal(false);
    setEditingConfig(null);
    await mutate();
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load dunning configurations. Please try again later.</p>
      </div>
    );
  }

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

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'email':
        return '✉️';
      case 'sms':
        return '📱';
      case 'grace_period':
        return '⏳';
      case 'cancel':
        return '🛑';
      default:
        return '❓';
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Dunning Management
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Configure dunning sequences for failed payments and invoice recovery
          </p>
        </div>
        <div>
          <Button
            variant="primary"
            onClick={handleCreateConfig}
            icon={<PlusIcon className="h-5 w-5 mr-2" />}
          >
            Create Configuration
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200">
        {processingError && (
          <div className="px-4 py-3 bg-red-50 border-b border-gray-200">
            <p className="text-sm text-red-700">{processingError}</p>
          </div>
        )}

        {configs && configs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Steps
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {configs.map((config) => (
                  <tr key={config.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{config.name}</div>
                      {config.description && (
                        <div className="text-sm text-gray-500">{config.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {config.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <BadgeCheckIcon className="h-4 w-4 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-2">
                        {config.steps.sort((a: any, b: any) => a.daysPastDue - b.daysPastDue).map((step: any, index: number) => (
                          <div key={index} className="flex items-center text-sm">
                            <SortAscendingIcon className="h-4 w-4 text-gray-400 mr-1" />
                            <span className="font-medium text-gray-900">Day {step.daysPastDue}</span>
                            <span className="mx-1">-</span>
                            <span className="text-gray-500">
                              {getActionIcon(step.action)} {getActionLabel(step.action)}
                              {step.retryPayment && ' (+ Retry Payment)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEditConfig(config)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(config)}
                          className="text-red-600 hover:text-red-900"
                          disabled={isProcessing || config.isActive}
                          title={config.isActive ? "Cannot delete active configuration" : "Delete configuration"}
                        >
                          <TrashIcon className={`h-5 w-5 ${config.isActive ? 'opacity-50 cursor-not-allowed' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <ExclamationCircleIcon className="h-12 w-12 text-yellow-400 mx-auto" />
            <p className="mt-2 text-gray-500">No dunning configurations found</p>
            <p className="text-sm text-gray-500 mt-1">
              Create a dunning configuration to automate payment recovery
            </p>
          </div>
        )}
      </div>

      <DunningConfigModal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setEditingConfig(null);
        }}
        onSave={handleConfigSaved}
        config={editingConfig}
      />

      <ConfirmationModal
        isOpen={!!configToDelete}
        onClose={() => setConfigToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Dunning Configuration"
        message={`Are you sure you want to delete the dunning configuration "${configToDelete?.name}"? This action cannot be undone.`}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        isProcessing={isProcessing}
      />
    </div>
  );
};

export default DunningManagement;