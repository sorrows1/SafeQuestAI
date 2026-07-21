import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import uiReducer from './uiSlice';
import scenariosReducer from './scenariosSlice';
import simulatorReducer from './simulatorSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    scenarios: scenariosReducer,
    simulator: simulatorReducer,
  },
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
