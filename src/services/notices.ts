export type AlertNotice = {
  title: string;
  body?: string;
  tone?: 'info' | 'warn' | 'good';
};

type Listener = (notice: AlertNotice) => void;

const listeners = new Set<Listener>();

export function subscribeNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitNotice(notice: AlertNotice): void {
  listeners.forEach((listener) => listener(notice));
}
