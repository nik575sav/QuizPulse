import { create } from 'zustand';

interface User {
  id: string;
  username: string;
}

interface AuthState {
  user: User | null;
  mode: 'organizer' | 'participant' | null;
  login: (user: User) => void;
  setMode: (mode: 'organizer' | 'participant') => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  mode: localStorage.getItem('mode') as any || null,
  login: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  setMode: (mode) => {
    localStorage.setItem('mode', mode);
    set({ mode });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('mode');
    set({ user: null, mode: null });
  },
}));
