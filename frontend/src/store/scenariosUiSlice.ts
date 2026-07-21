import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface ScenariosUiState {
  selectedId: string | null;
  searchQuery: string;
}

const initialState: ScenariosUiState = {
  selectedId: null,
  searchQuery: '',
};

const scenariosUiSlice = createSlice({
  name: 'scenariosUi',
  initialState,
  reducers: {
    selectScenario: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
});

export const { selectScenario, setSearchQuery } = scenariosUiSlice.actions;
export default scenariosUiSlice.reducer;
