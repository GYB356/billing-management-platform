'use client';

import { useState } from "react";
import useSWR from "swr";
import axios from "axios";

interface NotificationType {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  category: string;
}

interface NotificationSettings {
  types: NotificationType[];
}

export default function NotificationSettings() {
  const { data, mutate } = useSWR<NotificationSettings>("/api/customer/notifications");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (type: string) => {
    try {
      setUpdating(type);
      setError(null);
      await axios.post("/api/customer/notifications", { type });
      await mutate();
    } catch (err) {
      console.error("Error updating notification settings:", err);
      setError("Failed to update notification preferences");
    } finally {
      setUpdating(null);
    }
  };

  const groupedNotifications = data?.types.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationType[]>) || {};

  return (
    <div className="bg-white shadow-md p-6 rounded-xl border border-gray-200">
      <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      {!data ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="space-y-3">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : Object.keys(groupedNotifications).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedNotifications).map(([category, types]) => (
            <div key={category} className="space-y-4">
              <h3 className="font-medium text-gray-700">{category}</h3>
              <div className="space-y-4">
                {types.map((t) => (
                  <div key={t.name} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">{t.label}</div>
                      <p className="text-sm text-gray-500">{t.description}</p>
                    </div>
                    <div className="relative">
                      {updating === t.name && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={t.enabled}
                          onChange={() => toggle(t.name)}
                          disabled={updating === t.name}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No notification preferences available</p>
      )}
    </div>
  );
} 