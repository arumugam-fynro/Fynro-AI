export type Theme = 'dark' | 'light' | 'system';
export type Attachment = { id: string; kind: 'image' | 'doc' | 'link'; name: string; meta: string; url?: string };
export type Table = { cols: string[]; rows: string[][] };
export type Message = {
  role: 'user' | 'assistant';
  text: string;
  attachments?: Attachment[];
  sources?: string[];
  table?: Table;
  note?: string;
  error?: boolean;
  streaming?: boolean;
};
export type Chat = { id: string; title: string; pinned: boolean; updated: number; messages: Message[] };
export type Connector = { id: string; name: string; desc: string; connected: boolean; active: boolean };
export type Provider = 'anthropic' | 'openai';
export type NotifKind = 'info' | 'success' | 'alert' | 'reply';
export type Notif = { id: string; kind: NotifKind; title: string; body?: string; at: number; read: boolean; chatId?: string };

export type Persisted = {
  chats: Chat[];
  connectors: Connector[];
  theme: Theme;
  name: string;
  style: 'Concise' | 'Balanced' | 'Detailed';
  fy: 'Apr–Mar' | 'Jan–Dec';
  activeId: string | null;
  notifs: Notif[];
  notifPrefs: { replies: boolean; alerts: boolean; system: boolean };
  provider: Provider;
  model: string;
};
