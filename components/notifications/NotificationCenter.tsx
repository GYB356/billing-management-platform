import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Bell, Settings } from 'lucide-react'

interface Notification {
  id: string
  type: string
  message: string
  createdAt: string
  read: boolean
  priority: 'low' | 'medium' | 'high'
}

export function NotificationCenter() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({
    channels: ['email', 'in-app'],
    types: ['billing', 'security', 'system']
  })

  useEffect(() => {
    if (session?.user) {
      // Fetch existing notifications
      fetchNotifications()
      
      // Set up WebSocket connection
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS_URL}?token=${session.accessToken}`
      )

      ws.onmessage = (event) => {
        const notification = JSON.parse(event.data)
        setNotifications(prev => [notification, ...prev])
      }

      return () => {
        ws.close()
      }
    }
  }, [session])

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()
      setNotifications(data.notifications)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const updatePreferences = async () => {
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })
    } catch (error) {
      console.error('Error updating preferences:', error)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-full hover:bg-gray-100"
      >
        <Bell className="w-6 h-6" />
        {notifications.some(n => !n.read) && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full" />
        )}
      </button>

      {showSettings && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-500">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg ${
                  notification.read ? 'bg-gray-50' : 'bg-blue-50'
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium">{notification.type}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                    notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {notification.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                <span className="text-xs text-gray-400 mt-2">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-2">Notification Preferences</h4>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium">Channels</label>
                <div className="flex gap-2 mt-1">
                  {['email', 'in-app', 'slack'].map(channel => (
                    <label key={channel} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.channels.includes(channel)}
                        onChange={e => {
                          const newChannels = e.target.checked
                            ? [...preferences.channels, channel]
                            : preferences.channels.filter(c => c !== channel)
                          setPreferences(prev => ({
                            ...prev,
                            channels: newChannels
                          }))
                        }}
                        className="mr-1"
                      />
                      <span className="text-sm">{channel}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notification Types</label>
                <div className="flex gap-2 mt-1">
                  {['billing', 'security', 'system'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={preferences.types.includes(type)}
                        onChange={e => {
                          const newTypes = e.target.checked
                            ? [...preferences.types, type]
                            : preferences.types.filter(t => t !== type)
                          setPreferences(prev => ({
                            ...prev,
                            types: newTypes
                          }))
                        }}
                        className="mr-1"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={updatePreferences}
              className="mt-4 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  )
}