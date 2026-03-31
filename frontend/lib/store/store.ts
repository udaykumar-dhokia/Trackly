import { configureStore } from '@reduxjs/toolkit'
import projectsReducer from './features/projectsSlice'
import statsReducer from './features/statsSlice'
import apiKeysReducer from './features/apiKeysSlice'
import eventsReducer from './features/eventsSlice'
import tracesReducer from './features/tracesSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      projects: projectsReducer,
      stats: statsReducer,
      apiKeys: apiKeysReducer,
      events: eventsReducer,
      traces: tracesReducer,
    },
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
