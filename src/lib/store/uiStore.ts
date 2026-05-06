import { create } from "zustand";

type UiState = {
    selectedParticipantId: string | null;
    selectParticipant: (id: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
    selectedParticipantId: null,
    selectParticipant: (id) => set({ selectedParticipantId: id }),
}));
