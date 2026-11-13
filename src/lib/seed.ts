import type { Chat, Connector, Notif, Persisted } from './types';

const T = (h: number) => Date.now() - h * 3600e3;

export const seedChats = (): Chat[] => [
  { id: 'c1', title: 'Monthly budget — November', pinned: true, updated: T(2), messages: [
    { role: 'user', text: 'Break down my November spending across HDFC and ICICI.' },
    { role: 'assistant', sources: ['Fynro app'], text: 'Here is November so far (1–13 Nov) against the same days in October. Spending is up 13%, almost all of it from travel.',
      table: { cols: ['Category', 'Oct 1–13', 'Nov 1–13', 'Change'], rows: [['Rent', '₹32,000', '₹32,000', '0%'], ['Groceries', '₹8,420', '₹7,960', '−5%'], ['Dining out', '₹5,180', '₹6,340', '+22%'], ['Travel', '₹3,900', '₹9,750', '+150%'], ['Subscriptions', '₹4,640', '₹4,640', '0%']] },
      note: 'Travel includes a ₹6,200 IndiGo booking on 8 Nov. Without it, you are within 1% of October.' },
  ] },
  { id: 'c2', title: 'Q3 GST filing checklist', pinned: true, updated: T(30), messages: [
    { role: 'user', text: 'What do I need ready for GSTR-3B this quarter?' },
    { role: 'assistant', sources: ['Fynro app'], text: 'For the October–December quarter you will need:\n\n1. Sales register with GSTIN-wise outward supplies\n2. Purchase register reconciled against GSTR-2B\n3. Input tax credit summary (eligible and reversed)\n4. Challans for any tax already paid\n\nThe due date is 20 January.' },
  ] },
  { id: 'c3', title: 'SIP vs lump sum for ₹5L', pinned: false, updated: T(5), messages: [
    { role: 'user', text: 'I have ₹5 lakh. Should I invest it all now or spread it as a SIP?' },
    { role: 'assistant', text: 'With markets near highs, splitting it into a 6-month STP from a liquid fund reduces timing risk while keeping the money invested. If your horizon is over 7 years, the difference between the two approaches has historically been small.' },
  ] },
  { id: 'c4', title: 'Old vs new tax regime', pinned: false, updated: T(26), messages: [
    { role: 'user', text: 'Which regime is better for me this year?' },
    { role: 'assistant', text: 'At ₹18.4L gross with ₹1.5L in 80C and ₹25k in 80D, the new regime saves you about ₹41,600. The old regime only wins if your deductions cross roughly ₹4.6L.' },
  ] },
  { id: 'c5', title: 'Credit card statement review', pinned: false, updated: T(50), messages: [
    { role: 'user', text: 'Anything unusual on my October card statement?' },
    { role: 'assistant', text: 'Two items stand out: a duplicate ₹1,299 charge from Swiggy One on 14 Oct, and an international transaction fee of ₹412 on a USD purchase. The duplicate is worth disputing.' },
  ] },
  { id: 'c6', title: 'Unpaid client invoices', pinned: false, updated: T(80), messages: [
    { role: 'user', text: 'Which invoices are overdue?' },
    { role: 'assistant', text: 'Four invoices totalling ₹2,86,000 are past due. The oldest is INV-1042 to Kestrel Labs, 38 days overdue.' },
  ] },
  { id: 'c7', title: 'Rent vs buy in Bengaluru', pinned: false, updated: T(140), messages: [
    { role: 'user', text: 'Does buying a ₹1.2Cr flat make sense versus my ₹45k rent?' },
    { role: 'assistant', text: 'At an 8.5% home loan rate, your EMI would be about ₹83,000 on a ₹96L loan. Renting and investing the difference comes out ahead over 10 years unless prices rise faster than 6% a year.' },
  ] },
];

export const seedConnectors = (): Connector[] => [
  { id: 'fynro', name: 'Fynro app', desc: 'Accounts, transactions, budgets and goals', connected: true, active: true },
  { id: 'gmail', name: 'Gmail', desc: 'Invoices, receipts and statements', connected: false, active: false },
];

export const seedNotifs = (): Notif[] => [
  { id: 'n1', kind: 'alert', title: 'Duplicate charge detected', body: 'Swiggy One ₹1,299 was charged twice on 14 Oct.', at: T(3), read: false, chatId: 'c5' },
  { id: 'n2', kind: 'alert', title: '4 invoices overdue', body: '₹2,86,000 is past due. INV-1042 is 38 days late.', at: T(9), read: false, chatId: 'c6' },
  { id: 'n3', kind: 'info', title: 'GSTR-3B due 20 January', body: 'Your checklist is ready.', at: T(28), read: true, chatId: 'c2' },
];

export const defaults = (): Persisted => ({
  chats: seedChats(),
  connectors: seedConnectors(),
  theme: 'dark',
  name: 'Arjun',
  style: 'Balanced',
  fy: 'Apr–Mar',
  activeId: 'c1',
  notifs: seedNotifs(),
  notifPrefs: { replies: true, alerts: true, system: false },
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
});

export const MODELS: Record<'anthropic' | 'openai', { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  ],
  openai: [
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  ],
};
