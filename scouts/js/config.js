/* What a new Frata Scouts unité starts with: one fund, the caisse, and the usual scouting categories. */

export const APP_ID = 'frata-scouts';

/* The main fund has the id 'wallet' because the shared core (js/core/) treats that id as the default
   account. People see its name, "Caisse", and can rename it. Other funds (a bank account) can be added in Settings. */
export const DEFAULT_ACCOUNTS = [{ id: 'wallet', name: 'Caisse' }];

export const DEFAULT_CATS = [
  ['transport', 'Transport', 'expense', '🚌'],
  ['food', 'Food', 'expense', '🍽️'],
  ['equipment', 'Equipment', 'expense', '⛺'],
  ['venue', 'Venue & rent', 'expense', '🏠'],
  ['uniforms', 'Uniforms', 'expense', '👕'],
  ['activities', 'Activities', 'expense', '🎯'],
  ['admin', 'Admin & fees', 'expense', '📄'],
  ['other', 'Other', 'expense', '📦'],
  ['dues', 'Cotisations', 'income', '🧾'],
  ['donation', 'Donations', 'income', '💝'],
  ['fundraiser', 'Fundraising', 'income', '🥳'],
  ['other-in', 'Other income', 'income', '💰'],
].map(([id, name, type, icon]) => ({ id, name, type, icon }));

export const PROTECTED = ['other', 'other-in'];

export const CONTACT = { email: 'support@frata.cc' };
