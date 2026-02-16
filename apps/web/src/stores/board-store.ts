import { create } from "zustand";
import type { BoardColumn, TaskWithRelations } from "@dkflow/shared";

interface BoardState {
  columns: BoardColumn[];
  tasks: Record<string, TaskWithRelations[]>;
  setColumns: (columns: BoardColumn[]) => void;
  setTasksForColumn: (columnId: string, tasks: TaskWithRelations[]) => void;
  moveTask: (taskId: string, fromColumnId: string, toColumnId: string, position: number) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  columns: [],
  tasks: {},
  setColumns: (columns) => set({ columns }),
  setTasksForColumn: (columnId, tasks) =>
    set((state) => ({ tasks: { ...state.tasks, [columnId]: tasks } })),
  moveTask: (taskId, fromColumnId, toColumnId, position) =>
    set((state) => {
      const fromTasks = [...(state.tasks[fromColumnId] || [])];
      const toTasks = fromColumnId === toColumnId ? fromTasks : [...(state.tasks[toColumnId] || [])];
      const taskIndex = fromTasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return state;
      const [task] = fromTasks.splice(taskIndex, 1);
      toTasks.splice(position, 0, { ...task, columnId: toColumnId });
      return {
        tasks: {
          ...state.tasks,
          [fromColumnId]: fromTasks,
          [toColumnId]: toTasks,
        },
      };
    }),
}));
