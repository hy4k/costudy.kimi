import { useSyncExternalStore } from 'react';

export type Pin = {
  id: string;
  title: string;
  kind: string;
  tone: string;
};

const KEY = 'costudy-deck-pins';

function read(): Pin[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Pin[];
  } catch {
    return [];
  }
}

let pins: Pin[] = read();
const listeners = new Set<() => void>();

function write(next: Pin[]) {
  pins = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function isPinned(id: string) {
  return pins.some((p) => p.id === id);
}

export function togglePin(pin: Pin) {
  write(isPinned(pin.id) ? pins.filter((p) => p.id !== pin.id) : [...pins, pin]);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useDeckPins(): Pin[] {
  return useSyncExternalStore(subscribe, () => pins, () => pins);
}
