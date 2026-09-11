/** Admin API helpers (token from Vite env) */
export const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || ''

export function adminHeaders(extra = {}) {
  const headers = { ...extra }
  if (ADMIN_TOKEN) headers['X-Admin-Token'] = ADMIN_TOKEN
  return headers
}

export async function apiFetch(url, options = {}) {
  const opts = { ...options }
  opts.headers = adminHeaders(opts.headers || {})
  return fetch(url, opts)
}
