import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { scenariosApi } from '@/api';
import type { ScenarioDefinition } from '@/types';

interface ScenariosState {
  items: ScenarioDefinition[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
}

const initialState: ScenariosState = {
  items: [],
  selectedId: null,
  loading: false,
  error: null,
  searchQuery: '',
};

export const fetchScenarios = createAsyncThunk('scenarios/fetchAll', async () => {
  const res = await scenariosApi.list();
  return res.data;
});

export const createScenario = createAsyncThunk(
  'scenarios/create',
  async (scenario: ScenarioDefinition) => {
    const res = await scenariosApi.create(scenario);
    return res.data;
  }
);

export const updateScenario = createAsyncThunk(
  'scenarios/update',
  async ({ id, scenario }: { id: string; scenario: ScenarioDefinition }) => {
    const res = await scenariosApi.update(id, scenario);
    return res.data;
  }
);

export const deleteScenario = createAsyncThunk(
  'scenarios/delete',
  async (id: string) => {
    await scenariosApi.delete(id);
    return id;
  }
);

export const duplicateScenario = createAsyncThunk(
  'scenarios/duplicate',
  async (id: string) => {
    const res = await scenariosApi.duplicate(id);
    return res.data;
  }
);

const scenariosSlice = createSlice({
  name: 'scenarios',
  initialState,
  reducers: {
    selectScenario: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchScenarios.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchScenarios.fulfilled, (state, action) => {
        state.loading = false; state.items = action.payload;
      })
      .addCase(fetchScenarios.rejected, (state, action) => {
        state.loading = false; state.error = action.error.message ?? 'Failed to load';
      })
      .addCase(createScenario.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.selectedId = action.payload.id;
      })
      .addCase(updateScenario.fulfilled, (state, action) => {
        const idx = state.items.findIndex(s => s.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(deleteScenario.fulfilled, (state, action) => {
        state.items = state.items.filter(s => s.id !== action.payload);
        if (state.selectedId === action.payload) state.selectedId = null;
      })
      .addCase(duplicateScenario.fulfilled, (state, action) => {
        state.items.push(action.payload);
      });
  },
});

export const { selectScenario, setSearchQuery } = scenariosSlice.actions;
export default scenariosSlice.reducer;
