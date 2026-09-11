import { create } from "zustand";

interface FeedbackState { message: string; show: (message: string) => void; clear: () => void }
export const useFeedback = create<FeedbackState>((set) => ({ message: "", show: (message) => set({ message }), clear: () => set({ message: "" }) }));
