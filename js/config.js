/* Fixed accounts and the built-in categories. */

export const ACCOUNTS = [
  { id: 'wallet', name: 'Wallet' },
  { id: 'savings', name: 'Savings' },
  { id: 'whish', name: 'Whish' },
];

export const accName = (id) => (ACCOUNTS.find((a) => a.id === id) || { name: id }).name;

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
