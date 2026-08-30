// 轻量 toast 存储：模块级发布订阅，UI 侧由 <ToastHost />（components/Toast.tsx）渲染
export interface ToastItem {
  id: number;
  kind: "success" | "error";
  message: string;
}

type Listener = (items: ToastItem[]) => void;
const listeners = new Set<Listener>();
let items: ToastItem[] = [];
let seq = 0;

const emit = () => listeners.forEach(l => l([...items]));

const push = (kind: ToastItem["kind"], message: string) => {
  const id = ++seq;
  items = [...items, { id, kind, message }];
  emit();
  window.setTimeout(() => {
    items = items.filter(t => t.id !== id);
    emit();
  }, 2600);
};

export const subscribeToasts = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};
