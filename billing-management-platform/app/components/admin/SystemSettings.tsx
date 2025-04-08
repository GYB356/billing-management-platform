'use client';

import useSWR from "swr";
import axios from "axios";
import React, { useState } from 'react';

interface SystemSetting {
  key: string;
  label: string;
  value: boolean;
  description?: string;
}

export default function SystemSettings() {
  const { data, error, isLoading, mutate } = useSWR<SystemSetting[]>("/api/admin/settings");
  const [updating, setUpdating] = useState<string | null>(null);

  const updateSetting = async (key: string, value: boolean) => {
    try {
      setUpdating(key);
      await axios.post("/api/admin/settings", { key, value });
      await mutate();
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert the optimistic update
      await mutate();
    } finally {
      setUpdating(null);
    }
  };

  if (error) {
    return (
      <div className="bg-white shadow rounded-xl p-4">
        <p className="text-red-600">Failed to load system settings</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-xl p-4">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-4">System Settings</h2>
      <div className="space-y-4">
        {data?.map((setting) => (
          <div key={setting.key} className="flex items-center justify-between py-2 border-b last:border-b-0">
            <div className="flex-1">
              <div className="flex items-center">
                <span className="text-sm font-medium">{setting.label}</span>
                {updating === setting.key && (
                  <span className="ml-2 text-xs text-gray-500">Updating...</span>
                )}
              </div>
              {setting.description && (
                <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
              )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={setting.value}
                onChange={() => updateSetting(setting.key, !setting.value)}
                disabled={updating === setting.key}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
} 