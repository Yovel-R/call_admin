import { apiFetch, isLoggedIn, clearToken } from './api.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!isLoggedIn()) location.replace('./login.html');

// ── Show username ─────────────────────────────────────────────────────────────
const username = localStorage.getItem('admin_username') || 'Admin';
document.getElementById('navUser').textContent = username;
document.getElementById('avatarInitial').textContent = username[0].toUpperCase();

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    location.replace('./login.html');
});

// ── Load users ────────────────────────────────────────────────────────────────
async function loadUsers() {
    document.getElementById('tableBody').innerHTML = '<div class="loader">Loading…</div>';
    try {
        const users = await apiFetch('/api/users');
        renderTable(users);
    } catch (err) {
        if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
            clearToken(); location.replace('./login.html');
        }
        document.getElementById('tableBody').innerHTML =
            `<div class="empty">⚠️ ${err.message}</div>`;
    }
}

function renderTable(users) {
    document.getElementById('countBadge').textContent = users.length;
    if (!users.length) {
        document.getElementById('tableBody').innerHTML =
            '<div class="empty">📭 No users found</div>';
        return;
    }

    // Attach SweetAlert if not present
    if (!document.getElementById('swal-script')) {
        const script = document.createElement('script');
        script.id = 'swal-script';
        script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
        document.head.appendChild(script);
    }

    const rows = users.map(u => {
        const d = new Date(u.createdAt);
        const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        const activeBadge = u.isActive
            ? `<span style="background:#e6f4ea;color:#1e8e3e;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Active</span>`
            : `<span style="background:#fce8e6;color:#d93025;padding:4px 8px;border-radius:12px;font-size:12px;font-weight:600;">Inactive</span>`;

        return `<tr>
          <td style="font-weight: 500;" data-label="Service Name">
             ${u.serviceName || '—'}
          </td>
          <td class="col-number" data-label="Phone Number">
             ${u.phoneNumber || '—'}
          </td>
          <td data-label="Status">
             ${activeBadge}
          </td>
          <td data-label="Created At">
             <span style="color:var(--text-main); font-size:13px;">${date}</span>
          </td>
          <td data-label="Actions">
             <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;" onclick="toggleStatus('${u._id}', ${u.isActive})">
                ${u.isActive ? 'Deactivate' : 'Activate'}
             </button>
             <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px; color: #d93025; border-color: #fce8e6; background: #fce8e6;" onclick="deleteUser('${u._id}', '${u.serviceName}')">
                Delete
             </button>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('tableBody').innerHTML = `
      <table style="table-layout: fixed; width: 100%;">
        <thead><tr>
          <th style="width: 25%">Service Name</th>
          <th style="width: 20%">Phone Number</th>
          <th style="width: 15%">Status</th>
          <th style="width: 20%">Created At</th>
          <th style="width: 20%">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
}

window.toggleStatus = async function (id, currentStatus) {
    const action = currentStatus ? 'deactivate' : 'activate';

    if (window.Swal) {
        const result = await Swal.fire({
            title: `Are you sure?`,
            text: `Do you want to ${action} this user?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
            cancelButtonColor: '#aaa',
            confirmButtonText: `Yes, ${action}!`
        });
        if (!result.isConfirmed) return;
    } else {
        if (!confirm(`Do you want to ${action} this user?`)) return;
    }

    try {
        await apiFetch(`/api/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive: !currentStatus })
        });
        loadUsers();
    } catch (err) {
        alert(err.message || `Failed to ${action} user.`);
    }
};

window.deleteUser = async function (id, serviceName) {
    if (window.Swal) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `You will delete the user "${serviceName}" permanently!`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'Yes, delete it!'
        });
        if (!result.isConfirmed) return;
    } else {
        if (!confirm(`Are you sure you want to delete user "${serviceName}"?`)) return;
    }

    try {
        await apiFetch(`/api/users/${id}`, {
            method: 'DELETE'
        });
        loadUsers();
    } catch (err) {
        alert(err.message || 'Failed to delete user.');
    }
};

document.getElementById('refreshBtn').addEventListener('click', loadUsers);

// ── Add User Modal ────────────────────────────────────────────────────────────
const modal = document.getElementById('addUserModal');
const openBtn = document.getElementById('openAddUserBtn');
const closeBtn = document.getElementById('closeModalBtn');
const addUserForm = document.getElementById('addUserForm');
const modalError = document.getElementById('modalError');
const modalSuccess = document.getElementById('modalSuccess');
const submitBtn = document.getElementById('addUserSubmit');
const serviceNameInput = document.getElementById('serviceName');
const phoneNumberInput = document.getElementById('phoneNumber');
const pwdPreview = document.getElementById('generatedPassword');

function buildPassword(service, phone) {
    const prefix = service.trim().replace(/\s+/g, '').slice(0, 4).toLowerCase();
    const suffix = phone.replace(/\D/g, '').slice(-3);
    return prefix && suffix ? `${prefix}${suffix}` : '';
}

function updatePreview() {
    pwdPreview.value = buildPassword(serviceNameInput.value, phoneNumberInput.value);
}
serviceNameInput.addEventListener('input', updatePreview);
phoneNumberInput.addEventListener('input', updatePreview);

function openModal() { modal.classList.add('open'); addUserForm.reset(); pwdPreview.value = ''; hideAlerts(); }
function closeModal() { modal.classList.remove('open'); loadUsers(); } // Reload users when modal closes
function hideAlerts() { modalError.style.display = 'none'; modalSuccess.style.display = 'none'; }
function showError(msg) { modalError.textContent = msg; modalError.style.display = 'block'; modalSuccess.style.display = 'none'; }
function showSuccess(msg) { modalSuccess.textContent = msg; modalSuccess.style.display = 'block'; modalError.style.display = 'none'; }

openBtn.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serviceName = serviceNameInput.value.trim();
    const phoneNumber = phoneNumberInput.value.trim();
    const password = buildPassword(serviceName, phoneNumber);

    hideAlerts();
    if (!password) { showError('Fill in both Service Name and Phone Number.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';
    try {
        await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify({ serviceName, phoneNumber, password }),
        });
        showSuccess(`✅ "${serviceName}" created!  Password: ${password}`);
        addUserForm.reset();
        pwdPreview.value = '';
        // Note: we'll reload users list when the modal is closed
    } catch (err) {
        showError(err.message || 'Failed to create user.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create User';
    }
});

// ── Initial load ───────────────────────────────────────────────
loadUsers();
