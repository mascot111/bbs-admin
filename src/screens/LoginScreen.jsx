import React, { useState } from 'react';
import { LockKeyhole, Loader2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const LoginScreen = () => {
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await signIn(email, password);
      // Supabase listener in the store will automatically update the UI
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#e25f38]/10 text-[#e25f38] rounded-2xl flex items-center justify-center mx-auto mb-4 transform rotate-3">
            <LockKeyhole className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-[#1c1c1c]">
            B.B.S <span className="text-[#e25f38]">Admin</span>
          </h1>
          <p className="text-sm font-bold text-[#8c8a86] uppercase tracking-widest mt-1">Authorized Access Only</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-xs font-bold text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1 block">Admin Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f5f3ef] border-2 border-transparent focus:border-[#e25f38] focus:bg-white rounded-xl p-3.5 font-bold outline-none transition-all" 
            />
          </div>
          
          <div>
            <label className="text-xs font-bold text-[#8c8a86] uppercase tracking-widest mb-1 block">Passcode</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#f5f3ef] border-2 border-transparent focus:border-[#e25f38] focus:bg-white rounded-xl p-3.5 font-bold outline-none transition-all" 
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-4 mt-4 bg-[#e25f38] text-white rounded-xl font-bold shadow-xl hover:bg-[#d1502b] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authenticate'}
          </button>
        </form>

      </div>
    </div>
  );
};