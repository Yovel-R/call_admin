
const USE_LOCAL = false;
const LOCAL_URL = 'http://localhost:5001';
const PROD_URL = 'https://call-backend-fzhj.onrender.com'; // update when deployed

export const BASE_URL = USE_LOCAL ? LOCAL_URL : PROD_URL;

// ── Token helpers ─────────────────────────────────────────────────────────────
export function getToken() { return localStorage.getItem('admin_token'); }
export function setToken(t) { localStorage.setItem('admin_token', t); }
export function clearToken() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
}
export function isLoggedIn() { return !!getToken(); }


export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
}
