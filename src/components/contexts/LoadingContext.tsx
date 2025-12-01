import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';

interface LoadingContextProps {
  isPageLoading: boolean;
  setPageLoading: (isLoading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextProps | undefined>(undefined);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isPageLoading, setPageLoading] = useState<boolean>(false);

  // نستخدم useMemo لضمان عدم إعادة إنشاء الكائن value في كل مرة يتم فيها إعادة العرض
  const value = useMemo(() => ({ isPageLoading, setPageLoading }), [isPageLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const usePageLoading = (): LoadingContextProps => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('usePageLoading must be used within a LoadingProvider');
  }
  return context;
};