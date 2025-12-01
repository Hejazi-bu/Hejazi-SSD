import React, { createContext, useState, useContext, ReactNode, useMemo, useCallback } from 'react';

interface ActionLoadingContextProps {
  isActionLoading: boolean;
  actionMessage: string;
  showActionLoading: (message: string) => void;
  hideActionLoading: () => void;
}

const ActionLoadingContext = createContext<ActionLoadingContextProps | undefined>(undefined);

export const ActionLoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string>('');

  const showActionLoading = useCallback((message: string) => {
    setActionMessage(message);
    setIsActionLoading(true);
  }, []);

  const hideActionLoading = useCallback(() => {
    setIsActionLoading(false);
    setActionMessage('');
  }, []);

  const value = useMemo(() => ({ 
      isActionLoading, 
      actionMessage, 
      showActionLoading, 
      hideActionLoading 
    }), [isActionLoading, actionMessage, showActionLoading, hideActionLoading]);

  return (
    <ActionLoadingContext.Provider value={value}>
      {children}
    </ActionLoadingContext.Provider>
  );
};

export const useActionLoading = (): ActionLoadingContextProps => {
  const context = useContext(ActionLoadingContext);
  if (context === undefined) {
    throw new Error('useActionLoading must be used within an ActionLoadingProvider');
  }
  return context;
};