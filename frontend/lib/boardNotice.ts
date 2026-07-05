export type BoardNoticeSeverity = "error" | "warning" | "info";

export type BoardNotice = {
  id: string;
  message: string;
  severity: BoardNoticeSeverity;
};

type Listener = (notice: BoardNotice | null) => void;

const AUTO_DISMISS_MS: Record<BoardNoticeSeverity, number> = {
  error: 7000,
  warning: 6000,
  info: 4000,
};

let current: BoardNotice | null = null;
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener(current));
}

export function subscribeBoardNotice(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function clearBoardNotice(id?: string) {
  if (id != null && current?.id !== id) return;
  if (current) {
    const timer = timers.get(current.id);
    if (timer) clearTimeout(timer);
    timers.delete(current.id);
  }
  current = null;
  emit();
}

export function showBoardNotice(message: string, severity: BoardNoticeSeverity = "error") {
  const msg = message.trim();
  if (!msg) return;

  if (current) {
    const timer = timers.get(current.id);
    if (timer) clearTimeout(timer);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  current = { id, message: msg, severity };
  emit();

  const timeout = setTimeout(() => clearBoardNotice(id), AUTO_DISMISS_MS[severity]);
  timers.set(id, timeout);
}
