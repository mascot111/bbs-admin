import React, { useState } from 'react';
import { Search, Edit3, Power, PowerOff, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const MenuManagerScreen = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const categories = ['All', 'Meals', 'Drinks', 'Specials'];

  // 1. TANSTACK FETCH: Replaces useEffect. Auto-caches and handles loading states.
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    }
  });

  // 2. TANSTACK MUTATION: Handles the Kill Switch updates cleanly
  const toggleMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const { error } = await supabase
        .from('inventory')
        .update({ is_available: newStatus })
        .eq('id', id);
      if (error) throw error;
    },
    // Optimistic UI update before the database confirms
    onMutate: async ({ id, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['inventory'] });
      const previousInventory = queryClient.getQueryData(['inventory']);
      
      queryClient.setQueryData(['inventory'], old => 
        old.map(item => item.id === id ? { ...item, is_available: newStatus } : item)
      );
      
      return { previousInventory };
    },
    // Revert if the database fails
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['inventory'], context.previousInventory);
      alert("Failed to sync with database. Reverting.");
    },
    // Sync the cache in the background
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });

  const toggleItemAvailability = (id, currentStatus) => {
    toggleMutation.mutate({ id, newStatus: !currentStatus });
  };

  const filteredInventory = inventory.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#e25f38] mb-4" />
        <p className="font-bold text-[#8c8a86]">Loading live inventory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-[#e5e0d8] shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c8a86]" />
          <input 
            type="text" 
            placeholder="Search menu items..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3ef] border-transparent focus:bg-white focus:border-[#e25f38] border-2 rounded-xl outline-none font-bold text-sm transition-all"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                activeCategory === cat ? 'bg-[#1c1c1c] text-white shadow-md' : 'bg-[#f5f3ef] text-[#8c8a86] hover:bg-[#e5e0d8]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredInventory.map(item => (
          <div 
            key={item.id} 
            className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
              item.is_available 
                ? 'bg-white border-[#e5e0d8] hover:border-[#1c1c1c]/20 shadow-sm' 
                : 'bg-[#f5f3ef] border-transparent opacity-75'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest bg-[#1c1c1c] text-white px-2 py-1 rounded-md">
                  {item.category}
                </span>
                <button className="text-[#8c8a86] hover:text-[#1c1c1c] transition-colors">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className={`font-black text-lg mb-1 ${item.is_available ? 'text-[#1c1c1c]' : 'text-[#8c8a86] line-through'}`}>
                {item.name}
              </h3>
              <p className="font-bold text-[#e25f38]">GHS {item.price}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-[#e5e0d8] flex justify-between items-center">
              <span className={`text-xs font-bold uppercase tracking-widest ${item.is_available ? 'text-emerald-500' : 'text-red-500'}`}>
                {item.is_available ? 'Available (In Stock)' : 'Sold Out'}
              </span>
              
              <button 
                onClick={() => toggleItemAvailability(item.id, item.is_available)}
                className={`p-2.5 rounded-full shadow-md transition-all active:scale-90 ${
                  item.is_available 
                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' 
                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                }`}
              >
                {item.is_available ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
              </button>
            </div>
          </div>
        ))}

        {filteredInventory.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <p className="font-bold text-[#8c8a86]">No menu items found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};