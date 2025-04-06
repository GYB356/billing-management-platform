import { notification } from 'antd';

interface ActivityEvent {
  type: string;
  data?: any;
  timestamp: number;
  userId: string;
}

const activityQueue: ActivityEvent[] = [];

export const trackUserActivity = (type: string, data?: any) => {
  const event: ActivityEvent = {
    type,
    data,
    timestamp: Date.now(),
    userId: getCurrentUserId(), // Implement this based on your auth system
  };

  activityQueue.push(event);
  notifyActivityChange(event);
  sendToAnalytics(event);
};

const notifyActivityChange = (event: ActivityEvent) => {
  notification.info({
    message: 'Activity Tracked',
    description: `Action: ${event.type}`,
    placement: 'bottomRight',
  });
};

const sendToAnalytics = async (event: ActivityEvent) => {
  // Implement your analytics integration here
  console.log('Activity sent to analytics:', event);
};

const getCurrentUserId = (): string => {
  // Implement based on your auth system
  return 'user-123';
};
