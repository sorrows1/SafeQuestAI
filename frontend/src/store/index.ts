import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import { safeQuestApi } from './api';
import uiReducer from './uiSlice';
import scenariosUiReducer from './scenariosUiSlice';
import simulatorReducer from './simulatorSlice';

export const store = configureStore({
  reducer: {
    [safeQuestApi.reducerPath]: safeQuestApi.reducer,
    ui: uiReducer,
    scenariosUi: scenariosUiReducer,
    simulator: simulatorReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(safeQuestApi.middleware),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
