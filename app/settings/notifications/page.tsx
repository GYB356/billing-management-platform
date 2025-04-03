"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@headlessui/react";
import { BellIcon, EnvelopeIcon, DevicePhoneMobileIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { NotificationPreferences } from "@/lib/types";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function NotificationSettings() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: true,
    inApp: true,
    sms: false,
    push: false,
    types: {
      billing: true,
      security: true,
      updates: true,
      promotions: false,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  // Fetch user preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch("/api/user/notification-preferences");
        if (!response.ok) {
          throw new Error("Failed to fetch notification preferences");
        }
        
        const data = await response.json();
        setPreferences(data.preferences || {
          email: true,
          inApp: true,
          sms: false,
          push: false,
          types: {
            billing: true,
            security: true,
            updates: true,
            promotions: false,
          },
        });
        
        setPhoneNumber(data.phoneNumber || "");
        setDeviceToken(data.deviceToken || null);
      } catch (err) {
        setError("Failed to load your notification preferences.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Handle toggling a channel
  const handleChannelToggle = (channel: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [channel]: !prev[channel],
    }));
    
    // If SMS is enabled and no phone number, prompt for verification
    if (channel === "sms" && !preferences.sms && !phoneNumber) {
      setShowPhoneVerification(true);
    }
    
    // Clear success message when changes are made
    setSuccess(false);
  };

  // Handle toggling a notification type
  const handleTypeToggle = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: !prev.types?.[type as keyof typeof prev.types],
      },
    }));
    
    // Clear success message when changes are made
    setSuccess(false);
  };

  // Handle phone number update
  const handlePhoneSubmit = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/user/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update phone number");
      }
      
      setShowPhoneVerification(false);
      // Continue with enabling SMS
      setPreferences(prev => ({
        ...prev,
        sms: true,
      }));
    } catch (err) {
      setError("Failed to update phone number. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Handle push notification setup
  const handlePushSetup = async () => {
    try {
      // Check if the browser supports notifications
      if (!("Notification" in window)) {
        alert("This browser does not support push notifications");
        return;
      }
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Permission for notifications was denied");
        return;
      }
      
      // Register service worker for push notifications
      const registration = await navigator.serviceWorker.register("/push-service-worker.js");
      
      // Get push subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
        ),
      });
      
      // Send subscription to server
      const response = await fetch("/api/user/push-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });
      
      if (!response.ok) {
        throw new Error("Failed to register for push notifications");
      }
      
      // Enable push notifications
      setPreferences(prev => ({
        ...prev,
        push: true,
      }));
      
      const data = await response.json();
      setDeviceToken(data.deviceToken);
      alert("Push notifications enabled successfully!");
    } catch (err) {
      setError("Failed to set up push notifications. Please try again.");
      console.error(err);
    }
  };

  // Save all notification preferences
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const response = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ preferences }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update notification preferences");
      }
      
      setSuccess(true);
      
      // Scroll to top to show success message
      window.scrollTo(0, 0);
    } catch (err) {
      setError("Failed to save notification preferences. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Convert base64 to Uint8Array for VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-6 py-1">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="md:flex md:items-center md:justify-between md:space-x-5">
        <div className="flex items-center space-x-5">
          <div className="flex-shrink-0">
            <div className="relative">
              <BellIcon className="h-16 w-16 text-indigo-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
            <p className="text-sm font-medium text-gray-500">
              Manage how you receive notifications from the platform
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mt-6 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Your notification preferences have been updated successfully.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-6">
        <div className="sm:col-span-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Notification Channels</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select how you'd like to receive notifications from the platform.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <EnvelopeIcon className="h-6 w-6 text-gray-500 mr-3" />
                  <div>
                    <span className="font-medium text-gray-900">Email Notifications</span>
                    <p className="text-sm text-gray-500">Receive notifications via email</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email || false}
                  onChange={() => handleChannelToggle("email")}
                  className={classNames(
                    preferences.email ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  )}
                >
                  <span className="sr-only">Use email</span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      preferences.email ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BellIcon className="h-6 w-6 text-gray-500 mr-3" />
                  <div>
                    <span className="font-medium text-gray-900">In-App Notifications</span>
                    <p className="text-sm text-gray-500">
                      Receive notifications within the application
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.inApp || false}
                  onChange={() => handleChannelToggle("inApp")}
                  className={classNames(
                    preferences.inApp ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  )}
                >
                  <span className="sr-only">Use in-app</span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      preferences.inApp ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <PhoneIcon className="h-6 w-6 text-gray-500 mr-3" />
                  <div>
                    <span className="font-medium text-gray-900">SMS Notifications</span>
                    <p className="text-sm text-gray-500">
                      Receive text messages for important notifications
                      {phoneNumber && <span className="ml-1 text-gray-400">({phoneNumber})</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {!phoneNumber && !preferences.sms && (
                    <button
                      type="button"
                      onClick={() => setShowPhoneVerification(true)}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Add Phone
                    </button>
                  )}
                  <Switch
                    checked={preferences.sms || false}
                    onChange={() => handleChannelToggle("sms")}
                    className={classNames(
                      preferences.sms ? 'bg-indigo-600' : 'bg-gray-200',
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                    )}
                  >
                    <span className="sr-only">Use SMS</span>
                    <span
                      aria-hidden="true"
                      className={classNames(
                        preferences.sms ? 'translate-x-5' : 'translate-x-0',
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DevicePhoneMobileIcon className="h-6 w-6 text-gray-500 mr-3" />
                  <div>
                    <span className="font-medium text-gray-900">Push Notifications</span>
                    <p className="text-sm text-gray-500">
                      Receive notifications on your device
                      {deviceToken && <span className="ml-1 text-gray-400">(Device registered)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {!deviceToken && !preferences.push && (
                    <button
                      type="button"
                      onClick={handlePushSetup}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Setup Push
                    </button>
                  )}
                  <Switch
                    checked={preferences.push || false}
                    onChange={() => handleChannelToggle("push")}
                    className={classNames(
                      preferences.push ? 'bg-indigo-600' : 'bg-gray-200',
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                    )}
                  >
                    <span className="sr-only">Use push</span>
                    <span
                      aria-hidden="true"
                      className={classNames(
                        preferences.push ? 'translate-x-5' : 'translate-x-0',
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                      )}
                    />
                  </Switch>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sm:col-span-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Notification Types</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select which types of notifications you'd like to receive.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex flex-grow flex-col">
                  <span className="text-sm font-medium text-gray-900">Billing and Payments</span>
                  <span className="text-sm text-gray-500">
                    Subscription renewals, payment confirmations, and invoices
                  </span>
                </span>
                <Switch
                  checked={preferences.types?.billing || false}
                  onChange={() => handleTypeToggle("billing")}
                  className={classNames(
                    preferences.types?.billing ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  )}
                >
                  <span className="sr-only">Receive billing notifications</span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      preferences.types?.billing ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex flex-grow flex-col">
                  <span className="text-sm font-medium text-gray-900">Security Alerts</span>
                  <span className="text-sm text-gray-500">
                    Login attempts, password changes, and security updates
                  </span>
                </span>
                <Switch
                  checked={preferences.types?.security || false}
                  onChange={() => handleTypeToggle("security")}
                  className={classNames(
                    preferences.types?.security ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  )}
                >
                  <span className="sr-only">Receive security alerts</span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      preferences.types?.security ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex flex-grow flex-col">
                  <span className="text-sm font-medium text-gray-900">Product Updates</span>
                  <span className="text-sm text-gray-500">
                    New features, improvements, and announcements
                  </span>
                </span>
                <Switch
                  checked={preferences.types?.updates || false}
                  onChange={() => handleTypeToggle("updates")}
                  className={classNames(
                    preferences.types?.updates ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  )}
                >
                  <span className="sr-only">Receive product updates</span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      preferences.types?.updates ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex flex-grow flex-col">
                  <span className="text-sm font-medium text-gray-900">Marketing and Promotions</span>
                  <span className="text-sm text-gray-500">
                    Special offers, discounts, and promotional content
                  </span>
                </span>
                <Switch
                  checked={preferences.types?.promotions || false}
                  onChange={() => handleTypeToggle("promotions")}
                  className={classNames(
                    preferences.types?.promotions ? 'bg-indigo-600' : 'bg-gray-200',
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                  )}
                >
                  <span className="sr-only">Receive marketing notifications</span>
                  <span
                    aria-hidden="true"
                    className={classNames(
                      preferences.types?.promotions ? 'translate-x-5' : 'translate-x-0',
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                    )}
                  />
                </Switch>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          onClick={handleSave}
          disabled={saving}
          className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Phone verification modal */}
      {showPhoneVerification && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <PhoneIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Add Phone Number for SMS
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Enter your phone number to receive SMS notifications.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <div className="mb-4">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <div className="mt-1">
                    <input
                      type="tel"
                      name="phoneNumber"
                      id="phoneNumber"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="+1 (555) 123-4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex w-auto justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm"
                    onClick={() => setShowPhoneVerification(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex w-auto justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm"
                    onClick={handlePhoneSubmit}
                    disabled={saving || !phoneNumber}
                  >
                    {saving ? "Saving..." : "Add Phone"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 