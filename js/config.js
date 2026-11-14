/* The accounts and categories a new user starts with. */

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
