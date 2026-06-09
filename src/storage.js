const PREFIX = 'lexus_svc_';

export const storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(PREFIX + key);
      return val ? { value: val } : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(PREFIX + key, value);
      return true;
    } catch { return false; }
  },
  remove: (key) => {
    try { localStorage.removeItem(PREFIX + key); return true; }
    catch { return false; }
  }
};
