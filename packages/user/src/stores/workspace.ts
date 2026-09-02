import { writable } from 'svelte/store';
import { api } from '../lib/api';
import type { Workspace, WorkspaceWithMemberCount, WorkspaceCreateInput } from '@bits-pay/shared';

function createWorkspaceStore() {
  const { subscribe, set, update } = writable<WorkspaceWithMemberCount[]>([]);

  return {
    subscribe,
    async fetch() {
      const data = await api.get<WorkspaceWithMemberCount[]>('/app/workspaces');
      set(data);
    },
    async create(input: WorkspaceCreateInput) {
      const ws = await api.post<WorkspaceWithMemberCount>('/app/workspaces', input);
      update((list) => [...list, ws]);
      return ws;
    },
    async update(id: string, input: Partial<WorkspaceCreateInput>) {
      const ws = await api.put<WorkspaceWithMemberCount>(`/app/workspaces/${id}`, input);
      update((list) => list.map((w) => (w.id === id ? ws : w)));
      return ws;
    },
    async remove(id: string) {
      await api.delete(`/app/workspaces/${id}`);
      update((list) => list.filter((w) => w.id !== id));
    },
  };
}

export const workspaces = createWorkspaceStore();
