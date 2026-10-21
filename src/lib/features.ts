/**
 * Billing (rates, margins, revenue, idle cost, savings) and cost bands are hidden for now at the
 * managers' request; nothing is removed. Set VITE_SHOW_BILLING=true to show them again.
 * Read on each call so tests can switch it with vi.stubEnv.
 */
export const showBilling = (): boolean => import.meta.env.VITE_SHOW_BILLING === 'true'
