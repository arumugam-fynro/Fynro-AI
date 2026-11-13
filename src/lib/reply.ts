import type { Message } from './types';

type R = Pick<Message, 'text' | 'table' | 'note'>;

/** Offline fallback used when no API key is configured. */
export function makeReply(q: string, sources: string[]): R {
  const s = q.toLowerCase();
  if (/spend|budget|expense|month/.test(s)) return { text: 'Your spending for the last 30 days, grouped by category:', table: { cols: ['Category', 'Amount', 'Share'], rows: [['Rent', '₹32,000', '48%'], ['Groceries', '₹11,240', '17%'], ['Travel', '₹9,750', '15%'], ['Dining out', '₹8,910', '13%'], ['Subscriptions', '₹4,640', '7%']] }, note: 'Dining out is ₹2,400 above your monthly limit.' };
  if (/tax|regime|80c|itr/.test(s)) return { text: 'Comparing both regimes on your current salary and declared deductions:', table: { cols: ['', 'Old regime', 'New regime'], rows: [['Taxable income', '₹15,90,000', '₹17,65,000'], ['Tax + cess', '₹2,92,240', '₹2,50,640'], ['Difference', '', '₹41,600 lower']] }, note: 'The new regime is better unless you add about ₹4.6L more in deductions.' };
  if (/sip|invest|mutual|portfolio|stock|holding/.test(s)) return { text: 'Your portfolio today:', table: { cols: ['Holding', 'Value', 'Return'], rows: [['Nifty 50 index fund', '₹4,82,300', '+14.2%'], ['Parag Parikh Flexi Cap', '₹3,15,800', '+18.6%'], ['Direct equity (9 stocks)', '₹2,64,100', '+6.1%'], ['Liquid fund', '₹1,20,000', '+6.8%']] }, note: 'A ₹50,000 monthly SIP split 60/40 between the index and flexi-cap funds keeps your current allocation.' };
  if (/subscri|cancel/.test(s)) return { text: 'You are paying for 7 subscriptions (₹4,640/month). Three look unused in the last 60 days: Disney+ Hotstar (₹299), Audible (₹199) and a second Google One plan (₹130). Cancelling them saves ₹7,536 a year.' };
  if (/invoice|client|overdue/.test(s)) return { text: 'Four invoices are overdue, totalling ₹2,86,000. I can draft reminder emails for each client if you connect Gmail.' };
  return { text: sources.length ? 'I checked your connected accounts. Could you tell me the time period or account you want me to focus on? That will let me give exact figures.' : 'I can answer that more precisely with your data. Connect the Fynro app from the + menu, or add an API key in Settings to chat with a live model.' };
}
