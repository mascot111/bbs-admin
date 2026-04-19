import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Swal from 'sweetalert2';
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
import { supabase } from './lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, 
      refetchOnWindowFocus: true, 
    },
  },
});

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { session, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // THE OMNIPRESENT SUPABASE LISTENER & SWEETALERT ENGINE
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('global_admin_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          
          // 1. Only fire Audio & Toast on NEW orders (INSERT)
          if (payload.eventType === 'INSERT') {
            if (window.bbsAudioEngine) {
              window.bbsAudioEngine.currentTime = 0;
              window.bbsAudioEngine.play().catch(e => console.warn("Audio blocked", e));
            }

            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'info',
              iconColor: '#e25f38',
              title: `New Order: #BBS-${payload.new.id.split('-')[0].toUpperCase()}`,
              text: `${payload.new.customer_name} placed an order!`,
              showConfirmButton: false,
              timer: 6000,
              timerProgressBar: true,
              background: '#1c1c1c',
              color: '#fff'
            });
          }

          // 2. ALWAYS invalidate caches on ANY change (Insert, Update, Delete)
          queryClient.invalidateQueries({ queryKey: ['liveOrders'] });
          queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [session]);

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
          {activeTab === 'dashboard' && <DashboardScreen setActiveTab={setActiveTab} />}
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