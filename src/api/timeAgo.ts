// src/utils/timeAgo.ts
export function timeAgo(iso: string | number | Date) {
    const now = Date.now();
    const t = new Date(iso).getTime();
    const s = Math.max(1, Math.floor((now - t) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }