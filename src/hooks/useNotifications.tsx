import { Alert, Snackbar } from '@mui/material';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Severity = 'error' | 'warning' | 'info' | 'success';

interface Notification {
  message: string;
  severity: Severity;
}

interface NotificationsContextValue {
  /** Show a transient snackbar notification. Defaults to severity 'error'. */
  notify: (message: string, severity?: Severity) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * App-wide notification surface: a single MUI Snackbar rendered at the
 * provider, driven through the `useNotifications()` hook. A new notify()
 * call replaces the current message.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback((message: string, severity: Severity = 'error') => {
    setNotification({ message, severity });
    setOpen(true);
  }, []);

  const handleClose = (_event?: unknown, reason?: string) => {
    // Don't dismiss on a stray click elsewhere; errors should be read.
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={notification?.severity ?? 'error'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);

  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
