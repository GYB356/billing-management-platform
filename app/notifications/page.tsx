'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bell, Filter, Search, Inbox, Archive } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ITEMS_PER_PAGE = 20;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
  data?: Record<string, any>;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: 'all',
    status: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  useEffect(() => {
    fetchNotifications();
  }, [filter, pagination.page]);

  const fetchNotifications = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        ...(filter.type !== 'all' && { type: filter.type }),
        ...(filter.status === 'unread' && { unreadOnly: 'true' }),
        ...(filter.search && { search: filter.search }),
      });

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      
      const data = await response.json();
      setNotifications(data.notifications);
      setPagination({
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleMarkAsRead = async (ids: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications
      .filter(n => !n.readAt)
      .map(n => n.id);
    
    if (unreadIds.length > 0) {
      await handleMarkAsRead(unreadIds);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await handleMarkAsRead([notification.id]);
    }
    
    if (notification.data?.actionUrl) {
      window.location.href = notification.data.actionUrl;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'BILLING':
        return '💰';
      case 'USAGE':
        return '📊';
      case 'SYSTEM':
        return '🔧';
      default:
        return '📬';
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-gray-600 mt-2">Manage your billing and system notifications</p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-4">
            <Select
              value={filter.type}
              onValueChange={(value) => setFilter({ ...filter, type: value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BILLING">Billing</SelectItem>
                <SelectItem value="USAGE">Usage</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filter.status}
              onValueChange={(value) => setFilter({ ...filter, status: value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search notifications..."
                className="pl-9"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>
          </div>

          {notifications.some(n => !n.readAt) && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Inbox className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No notifications found</p>
                <p className="text-sm">Check back later for updates</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl" role="img" aria-label={notification.type}>
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <Badge variant={notification.readAt ? 'secondary' : 'default'}>
                            {notification.type}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.readAt && (
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-blue-600" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * ITEMS_PER_PAGE) + 1} to{' '}
              {Math.min(pagination.page * ITEMS_PER_PAGE, pagination.total)} of{' '}
              {pagination.total} notifications
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}