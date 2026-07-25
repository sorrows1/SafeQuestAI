import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

const stored = (() => {
  try {
    return {
      accessToken: localStorage.getItem('sq_access') ?? null,
      refreshToken: localStorage.getItem('sq_refresh') ?? null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
})();

const initialState: AuthState = {
  user: null,
  accessToken: stored.accessToken,
  refreshToken: stored.refreshToken,
  isAuthenticated: !!stored.accessToken,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      localStorage.setItem('sq_access', action.payload.accessToken);
      localStorage.setItem('sq_refresh', action.payload.refreshToken);
    },
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('sq_access');
      localStorage.removeItem('sq_refresh');
    },
  },
});

export const { setTokens, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
