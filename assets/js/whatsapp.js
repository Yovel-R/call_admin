import { apiFetch, isLoggedIn, clearToken } from './api.js';

// ── Auth guard ────────────────────────────────────────────────────────────────
if (!isLoggedIn()) location.replace('./login.html');

// ── DOM refs ─────────────────────────────────────────────────────────────────
const tableBody = document.getElementById('tableBody');
const countBadge = document.getElementById('countBadge');
const configModal = document.getElementById('configModal');
const deleteModal = document.getElementById('deleteModal');
const configForm = document.getElementById('configForm');
const modalTitle = document.getElementById('modalTitle');
const editId = document.getElementById('editId');
const serviceNumber = document.getElementById('serviceNumber');
const waNumberInput = document.getElementById('waNumberInput');
const waNumberList = document.getElementById('waNumberList');
const cycleCount = document.getElementById('cycleCount');
const modalError = document.getElementById('modalError');
const modalSuccess = document.getElementById('modalSuccess');
const deleteId = document.getElementById('deleteId');
const navUser = document.getElementById('navUser');
const avatarInitial = document.getElementById('avatarInitial');

// ── Nav user ──────────────────────────────────────────────────────────────────
const adminName = localStorage.getItem('admin_username') || 'Admin';
navUser.textContent = adminName;
avatarInitial.textContent = adminName.charAt(0).toUpperCase();

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    location.replace('./login.html');
});

// ── State ─────────────────────────────────────────────────────────────────────
let waNumbers = []; // staged WA numbers in the modal
let allUsers = [];  // loaded services

// ── Load Services Dropdown ────────────────────────────────────────────────────
async function loadServices() {
    try {
        allUsers = await apiFetch('/api/users');
        serviceNumber.innerHTML = '<option value="" disabled selected>Select a service…</option>' +
            allUsers.map(u => `<option value="${u.phoneNumber}">${u.serviceName} (${u.phoneNumber})</option>`).join('');
    } catch (err) {
        console.error('Failed to load services', err);
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showAlert(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
}
function hideAlerts() {
    [modalError, modalSuccess].forEach(el => { el.style.display = 'none'; el.textContent = ''; });
}

function renderWaPills() {
    waNumberList.innerHTML = waNumbers.map((n, i) => `
        <span class="wa-pill">
            ${n}
            <button type="button" class="wa-pill-remove" data-idx="${i}" title="Remove">✕</button>
        </span>
    `).join('');

    waNumberList.querySelectorAll('.wa-pill-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            waNumbers.splice(Number(btn.dataset.idx), 1);
            renderWaPills();
        });
    });
}

function addWaNumber() {
    let val = waNumberInput.value.trim();
    if (!val) return;

    // Auto-prefix with +91 if it's just a 10-digit number
    if (/^\d{10}$/.test(val)) val = '+91' + val;
    // Just in case they typed 91 without the +
    if (/^91\d{10}$/.test(val)) val = '+' + val;

    if (!waNumbers.includes(val)) waNumbers.push(val);
    waNumberInput.value = '';
    renderWaPills();
}

// ── Table ─────────────────────────────────────────────────────────────────────
async function loadConfigs() {
    tableBody.innerHTML = '<div class="loader">Loading…</div>';
    try {
        const data = await apiFetch('/api/whatsapp');

        countBadge.textContent = data.length;

        if (!data.length) {
            tableBody.innerHTML = `<div class="empty">No WhatsApp routing configs yet.<br>Click <strong>＋ Add Config</strong> to get started.</div>`;
            return;
        }

        const rows = data.map(cfg => {
            const progress = cfg.cycleCount > 0
                ? Math.round((cfg.currentBatchCount / cfg.cycleCount) * 100)
                : 0;

            const waList = cfg.whatsappNumbers.map((n, i) =>
                `<span class="wa-pill" style="${i === cfg.currentIndex ? 'background:#eef2ff;color:#4f46e5;border-color:#c7d2fe;' : ''}">${n}${i === cfg.currentIndex ? ' ◀' : ''}</span>`
            ).join('');

            return `
            <tr>
                <td data-label="Service Number"><span class="col-number">${cfg.serviceNumber}</span></td>
                <td data-label="WA Handlers"><div class="wa-number-list">${waList}</div></td>
                <td data-label="Cycle Count">${cfg.cycleCount}</td>
                <td data-label="Batch Progress">
                    <div class="progress-bar-wrap">
                        <div class="progress-bar" style="width:${progress}%"></div>
                    </div>
                    <div class="cycle-info">${cfg.currentBatchCount} / ${cfg.cycleCount} calls</div>
                </td>
                <td data-label="Actions" style="white-space:nowrap;">
                    <button class="btn btn-ghost" style="padding:5px 10px;font-size:12px;" data-edit="${cfg._id}">✏️ Edit</button>
                    <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" data-del="${cfg._id}">🗑 Delete</button>
                </td>
            </tr>`;
        }).join('');

        tableBody.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Service Number</th>
                        <th>WA Handlers</th>
                        <th>Cycle Count</th>
                        <th>Batch Progress</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;

        tableBody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(data.find(c => c._id === btn.dataset.edit)));
        });
        tableBody.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', () => openDeleteModal(btn.dataset.del));
        });

    } catch (err) {
        if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
            clearToken(); location.replace('./login.html');
        }
        tableBody.innerHTML = `<div class="empty">⚠️ Failed to load configs: ${err.message}</div>`;
    }
}

// ── Modal — Add ───────────────────────────────────────────────────────────────
function openAddModal() {
    editId.value = '';
    serviceNumber.value = '';
    serviceNumber.disabled = false;
    cycleCount.value = 3;
    waNumbers = [];
    renderWaPills();
    hideAlerts();
    modalTitle.textContent = 'Add WhatsApp Config';
    configModal.classList.add('open');
}

// ── Modal — Edit ──────────────────────────────────────────────────────────────
function openEditModal(cfg) {
    editId.value = cfg._id;
    serviceNumber.value = cfg.serviceNumber;
    serviceNumber.disabled = true;
    cycleCount.value = cfg.cycleCount;
    waNumbers = [...cfg.whatsappNumbers];
    renderWaPills();
    hideAlerts();
    modalTitle.textContent = 'Edit WhatsApp Config';
    configModal.classList.add('open');
}

function closeConfigModal() { configModal.classList.remove('open'); }

// ── Modal — Delete ────────────────────────────────────────────────────────────
function openDeleteModal(id) {
    deleteId.value = id;
    deleteModal.classList.add('open');
}
function closeDeleteModal() { deleteModal.classList.remove('open'); }

// ── Submit ────────────────────────────────────────────────────────────────────
configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlerts();

    if (waNumbers.length === 0) {
        showAlert(modalError, 'Please add at least one WhatsApp handler number.');
        return;
    }

    const isEdit = !!editId.value;
    const payload = { whatsappNumbers: waNumbers, cycleCount: Number(cycleCount.value) };
    if (!isEdit) payload.serviceNumber = serviceNumber.value.trim();

    try {
        await apiFetch(isEdit ? `/api/whatsapp/${editId.value}` : '/api/whatsapp', {
            method: isEdit ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        showAlert(modalSuccess, isEdit ? 'Config updated!' : 'Config created!');
        setTimeout(() => { closeConfigModal(); loadConfigs(); }, 800);
    } catch (err) {
        showAlert(modalError, err.message);
    }
});

// ── Delete confirm ────────────────────────────────────────────────────────────
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    try {
        await apiFetch(`/api/whatsapp/${deleteId.value}`, { method: 'DELETE' });
        closeDeleteModal();
        loadConfigs();
    } catch (err) {
        alert(`Delete failed: ${err.message}`);
    }
});

// ── Event wiring ──────────────────────────────────────────────────────────────
document.getElementById('openAddBtn').addEventListener('click', openAddModal);
document.getElementById('refreshBtn').addEventListener('click', loadConfigs);
document.getElementById('closeModalBtn').addEventListener('click', closeConfigModal);
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
document.getElementById('addWaNumberBtn').addEventListener('click', addWaNumber);
waNumberInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addWaNumber(); } });
configModal.addEventListener('click', (e) => { if (e.target === configModal) closeConfigModal(); });
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

// ── Init ──────────────────────────────────────────────────────────────────────
loadServices();
loadConfigs();
