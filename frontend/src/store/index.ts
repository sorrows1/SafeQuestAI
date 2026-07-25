import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import { safeQuestApi } from './api';
import uiReducer from './uiSlice';
import authReducer from './authSlice';
import scenariosUiReducer from './scenariosUiSlice';
import simulatorReducer from './simulatorSlice';
import simulationViewerReducer from "@/features/simulation/simulationViewerSlice";
import familySessionReducer from "@/features/family/familySessionSlice";

export const store = configureStore({
  reducer: {
    [safeQuestApi.reducerPath]: safeQuestApi.reducer,
    ui: uiReducer,
    auth: authReducer,
    scenariosUi: scenariosUiReducer,
    simulator: simulatorReducer,
    simulationViewer: simulationViewerReducer,
    familySession: familySessionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(safeQuestApi.middleware),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
