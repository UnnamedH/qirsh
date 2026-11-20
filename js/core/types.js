/* Shared JSDoc types for the money core, checked by `npm run typecheck`. Nothing here runs. */

/** @typedef {'USD' | 'LBP'} Cur */
/** @typedef {{ USD: number, LBP: number }} Vec */
/** @typedef {{ id: string, name: string, hidden?: boolean, savings?: boolean }} Account */
/** @typedef {{ id: string, name: string }} Category */
/**
 * An entry. Only the fields the core reads are listed; apps may keep more.
 * @typedef {object} Tx
 * @property {string} id
 * @property {string} type
 * @property {string} date
 * @property {number} [amount]
 * @property {Cur} [currency]
 * @property {number} [amount2]
 * @property {number} [rate]
 * @property {string} [account]
 * @property {string} [categoryId]
 */
/**
 * The part of an app's saved data that the core reads and writes.
 * @typedef {object} CoreState
 * @property {number} rate
 * @property {{ weekStart: number, display?: string }} settings
 * @property {Account[]} accounts
 * @property {Record<string, Vec>} opening
 * @property {Category[]} categories
 * @property {Tx[]} tx
 */

export {};
