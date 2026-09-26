import { useEffect, useState } from 'react';
import { subscribeToCollection } from '../services/db';
import { useAuth } from '../lib/AuthContext';
import { Notification } from '../types';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // We only want to notify on NEW notifications that were added after the app started
    const startTime = new Date();
    
    const unsubscribe = subscribeToCollection<Notification>('notifications', (data) => {
      setNotifications(data);
      
      // Filter for notifications added in the last few seconds to show toast
      const latest = data[0];
      if (latest && !latest.read) {
        const createdAt = (latest as any).createdAt?.toDate?.() || new Date(latest.createdAt);
        if (createdAt > startTime) {
          toast(latest.message, {
            description: format(createdAt, 'HH:mm'),
            icon: latest.type === 'Success' ? '✅' : 'ℹ️',
          });
        }
      }
    }, user.uid);

    return unsubscribe;
  }, [user]);

  return { notifications };
};
