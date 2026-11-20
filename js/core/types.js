/* Shared JSDoc types for the money core, checked by `npm run typecheck`. Nothing here runs. */

/** @typedef {'USD' | 'LBP'} Cur */
/** @typedef {{ USD: number, LBP: number }} Vec */
/** @typedef {{ id: string, name: string, hidden?: boolean, savings?: boolean }} Account */
/** @typedef {{ id: string, name: string, type?: string, icon?: string }} Category */
/** @typedef {{ start: Date, end: Date }} Range */
/** @typedef {{ amount: number | string, currency: Cur, period: string, categoryId?: string | null }} Budget */
/**
 * An entry, after normalize(). Only the fields the core reads are listed; apps may keep more.
 * @typedef {object} Tx
 * @property {string} id
 * @property {string} type
 * @property {string} date
 * @property {number} amount
 * @property {Cur} currency
 * @property {number} [amount2]
 * @property {number} [rate]
 * @property {string} [account]
 * @property {string} [categoryId]
 * @property {string} [from]
 * @property {string} [to]
 * @property {number} [toAmount]
 * @property {Cur} [toCurrency]
 * @property {Vec} [back]
 * @property {{ currency: Cur, amount: number }} [change]
 * @property {Cur} [priceCur]
 * @property {string} [advanceId]
 * @property {boolean} [closed]
 * @property {string} [keptCat]
 * @property {string} [closedOn]
 * @property {number} [createdAt]
 * @property {string} [note]
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
/** @typedef {{ whole?: boolean, round?: boolean, sign?: boolean }} FmtOptions */

export {};
