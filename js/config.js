/* The accounts and categories a new user starts with. */

/* Where feedback and bug reports go (Settings → Feedback & bugs). The number is in international
   format without the +, as WhatsApp links need it. */
export const CONTACT = { whatsapp: '96181457620', email: 'support@frata.cc' };

/* Whish payment link for "Buy me a coffee" (Settings → Support Frata): the person picks the amount in
   Whish. It's the link inside the maker's Whish QR code. */
export const SUPPORT_URL = 'https://whish.money/app/pay/ynLO2j39h';

/* Frata's code is public, so anyone can check what it does with their data (Settings, at the bottom). */
export const REPO_URL = 'https://github.com/UnnamedH/qirsh';

/* People can rename these, add more and remove all but the first (see js/accounts.js). */
export const DEFAULT_ACCOUNTS = [
  { id: 'wallet', name: 'Wallet' },
  { id: 'savings', name: 'Savings', savings: true },
  { id: 'whish', name: 'Whish' },
];

export const DEFAULT_CATS = [
  ['food', 'Food', 'expense', '🍽️'],
  ['coffee', 'Coffee', 'expense', '☕'],
  ['groceries', 'Groceries', 'expense', '🛒'],
  ['transport', 'Transport', 'expense', '🚌'],
  ['bills', 'Bills & generator', 'expense', '⚡'],
  ['phone', 'Phone & internet', 'expense', '📱'],
  ['uni', 'University', 'expense', '🎓'],
  ['outing', 'Going out', 'expense', '🎉'],
  ['shopping', 'Shopping', 'expense', '🛍️'],
  ['health', 'Health', 'expense', '💊'],
  ['gifts', 'Gifts', 'expense', '🎁'],
  ['other', 'Other', 'expense', '📦'],
  ['salary', 'Salary', 'income', '💼'],
  ['side', 'Side work', 'income', '🛠️'],
  ['gift-in', 'Gift', 'income', '💝'],
  ['other-in', 'Other income', 'income', '💰'],
].map(([id, name, type, icon]) => ({ id, name, type, icon }));

export const PROTECTED = ['other', 'other-in'];
