import React, { createContext, useContext, useState, useCallback } from 'react';

const RefreshContext = createContext(null);

export function RefreshProvider({ children }) {
    const [refreshKey, setRefreshKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const triggerRefresh = useCallback(() => {
        setIsRefreshing(true);
        setRefreshKey(prev => prev + 1);
        window.dispatchEvent(new CustomEvent('zl-global-refresh'));
        setTimeout(() => {
            setIsRefreshing(false);
        }, 800);
    }, []);

    return (
        <RefreshContext.Provider value={{ refreshKey, isRefreshing, triggerRefresh }}>
            {children}
        </RefreshContext.Provider>
    );
}

export function useRefresh() {
    const context = useContext(RefreshContext);
    if (!context) {
        throw new Error('useRefresh must be used within a RefreshProvider');
    }
    return context;
}
