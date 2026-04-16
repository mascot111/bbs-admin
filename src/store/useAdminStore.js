import { create } from 'zustand';

export const useAdminStore = create((set, get) => ({
  // --- ORDER QUEUE STATE ---
  orders: [
    { id: '#BBS-1042', customer: 'Kwame Osei', phone: '024 123 4567', items: 'Signature Jollof (x2)', total: 130, status: 'New', time: '11:20 AM' },
    { id: '#BBS-1041', customer: 'Jane Doe', phone: '055 987 6543', items: 'Fresh Pineapple Juice', total: 20, status: 'Prepping', time: '11:05 AM' },
    { id: '#BBS-1040', customer: 'Mascot Ahenkorah', phone: '020 555 7777', items: 'Crispy Fried Rice, Shito', total: 70, status: 'Ready', time: '10:45 AM' },
    { id: '#BBS-1039', customer: 'Ama Mensah', phone: '024 444 3333', items: 'Waakye Special', total: 45, status: 'Delivered', time: '09:30 AM' },
  ],

  updateOrderStatus: (orderId, newStatus) => set((state) => ({
    orders: state.orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    )
  })),

  getStats: () => {
    const orders = get().orders;
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const active = orders.filter(o => ['New', 'Prepping', 'Ready'].includes(o.status)).length;
    return { totalOrders: orders.length, revenue, activeQueue: active };
  },

  // --- MENU MANAGER STATE (NEW) ---
  inventory: [
    { id: 'm1', name: 'Signature Jollof & Grilled Chicken', price: 65, category: 'Meals', isAvailable: true },
    { id: 'm2', name: 'Crispy Fried Rice & Beef Sauce', price: 70, category: 'Meals', isAvailable: true },
    { id: 'm3', name: 'Waakye Special', price: 45, category: 'Meals', isAvailable: false },
    { id: 'd1', name: 'Fresh Pineapple Juice', price: 20, category: 'Drinks', isAvailable: true },
    { id: 'd2', name: 'Bissap (Sobolo)', price: 15, category: 'Drinks', isAvailable: true },
  ],

  toggleItemAvailability: (itemId) => set((state) => ({
    inventory: state.inventory.map(item =>
      item.id === itemId ? { ...item, isAvailable: !item.isAvailable } : item
    )
  }))
}));