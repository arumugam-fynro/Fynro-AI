import { DEFAULT_MODEL } from './models';
import type { Persisted } from './types';

/** A brand-new account starts empty: no sample chats, notifications or data. */
export const defaults = (): Persisted => ({
  chats: [],
  theme: 'dark',
  name: '',
  style: 'Balanced',
  fy: 'Apr–Mar',
  activeId: null,
  notifs: [],
  notifPrefs: { replies: true, system: false },
  model: DEFAULT_MODEL,
});
