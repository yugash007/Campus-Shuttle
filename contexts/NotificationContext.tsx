
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface NotificationState {
  id: number;
  title: string;
  message: string;
  persistent?: boolean;
}

interface NotificationContextType {
  notification: NotificationState | null;
  showNotification: (title: string, message: string, persistent?: boolean) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const showNotification = useCallback((title: string, message: string, persistent = false) => {
    setNotification({ id: Date.now(), title, message, persistent });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
