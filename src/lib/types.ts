export type Theme = 'dark' | 'light' | 'system';
export type Attachment = {
  id: string;
  kind: 'image' | 'doc';
  name: string;
  meta: string;
  url?: string;                              // small thumbnail, persisted
  file?: { mime: string; data: string };     // base64 for images/PDFs, in memory only
  text?: string;                             // inlined content of text files, in memory only
};
export type Message = { role: 'user' | 'assistant'; text: string; attachments?: Attachment[]; error?: boolean; streaming?: boolean };
export type Chat = { id: string; title: string; pinned: boolean; updated: number; messages: Message[] };
export type NotifKind = 'info' | 'success' | 'alert' | 'reply';
export type Notif = { id: string; kind: NotifKind; title: string; body?: string; at: number; read: boolean; chatId?: string };

export type Persisted = {
  chats: Chat[];
  theme: Theme;
  name: string;
  style: 'Concise' | 'Balanced' | 'Detailed';
  fy: 'Apr–Mar' | 'Jan–Dec';
  activeId: string | null;
  notifs: Notif[];
  notifPrefs: { replies: boolean; system: boolean };
  model: string;
};
