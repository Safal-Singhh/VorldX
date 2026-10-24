import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 15 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'vorldx-query-cache-v1',
  throttleTime: 1_000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: 24 * 60 * 60 * 1000,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  },
};
