import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLayout } from './layouts/AdminLayout';
import { DashboardScreen } from './screens/DashboardScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { MenuManagerScreen } from './screens/MenuManagerScreen';
import { CustomersCRM } from './screens/CustomersCRM';
import CateringQuotes from './screens/CateringQuotes';
import { FinancialIntelScreen } from './screens/FinancialIntelScreen';
import { MarketingScreen } from './screens/MarketingScreen';
import { LoginScreen } from './screens/LoginScreen';
import { useAuthStore } from './store/useAuthStore';

// Initialize the global cache engine
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Cache stays fresh for 5 minutes
      refetchOnWindowFocus: true, // Auto-update on tab switch
    },
  },
});

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { session, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return <div className="min-h-screen bg-[#1c1c1c]" />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="selection:bg-[#e25f38] selection:text-white font-sans antialiased">
        <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
          {activeTab === 'dashboard' && <DashboardScreen />}
          {activeTab === 'orders' && <OrdersListScreen />}
          {activeTab === 'menu' && <MenuManagerScreen />}
          {activeTab === 'customers' && <CustomersCRM />}
          {activeTab === 'quotes' && <CateringQuotes />}
          {activeTab === 'marketing' && <MarketingScreen />}
          {activeTab === 'analytics' && <FinancialIntelScreen />}
          {activeTab === 'settings' && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
              <h2 className="text-2xl font-black text-[#1c1c1c] mb-2">System Settings</h2>
              <p className="text-[#8c8a86] font-bold">Configuration module is currently restricted to Super Admin level.</p>
            </div>
          )}
        </AdminLayout>
      </div>
    </QueryClientProvider>
  );
}