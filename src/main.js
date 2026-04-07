/*
  Version: 1.9.0
  Date: 2026-04-08
  Changelog:
  - Integrated 'produksi' state into UI rendering, CSV export, and filtering logic.
  - Refactored deathDate calculation to freeze only on failure states.
  - Added dynamic badging logic based on 3 major states (Production, Active, Dead).
*/
import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { renderCharts } from './charts.js';

const showToast = (message, isError = false) => {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const bulbForm = document.getElementById('bulb-form');
const bulbListContainer = document.getElementById('bulb-list-container');
const totalCountEl = document.getElementById('total-count');
const avgAgeEl = document.getElementById('avg-age-value');
const qcFailsEl = document.getElementById('qc-fail-percentage');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const btnExportCSV = document.getElementById('btn-export-csv');

let globalDocsData = []; 
let docIdToDelete = null;
let docToEdit = null;

const deleteModal = document.getElementById('custom-delete-modal');
const editModal = document.getElementById('edit-modal');

const calculateDays = (startDate, endDate = new Date()) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0,0,0,0); end.setHours(0,0,0,0);
    return Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
};

const generateRandomSuffix = () => {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
    return c[Math.floor(Math.random()*26)] + c[Math.floor(Math.random()*26)];
};

bulbForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "bulbs"), {
            batch: document.getElementById('bulb-batch').value,
            productionDate: document.getElementById('prod-date').value,
            status: document.getElementById('bulb-status').value,
            randomSuffix: generateRandomSuffix(),
            createdAt: new Date()
        });
        bulbForm.reset();
        showToast("Data produksi berhasil disimpan!");
    } catch (error) { showToast("Gagal menyimpan data", true); }
});

btnExportCSV.addEventListener('click', () => {
    if (globalDocsData.length === 0) return showToast("Data kosong!", true);
    let csvContent = "Kode ARB,Batch,Tanggal Produksi,Status,Umur (Hari)\n";
    
    const statusMap = {
        'produksi': 'Tahap Produksi',
        'active': 'Aktif Normal',
        'dead_chip': 'Gagal: Chip LED',
        'dead_driver': 'Gagal: Driver',
        'dead_solder': 'Gagal: Solder'
    };

    globalDocsData.forEach((data, index) => {
        const urutan = globalDocsData.length - index;
        const code = `ARB-${String(urutan).padStart(3, '0')}${data.randomSuffix || 'XX'}`;
        const age = data.failedDate ? calculateDays(data.productionDate, data.failedDate) : calculateDays(data.productionDate);
        const stText = statusMap[data.status] || data.status;
        csvContent += `${code},${data.batch},${data.productionDate},${stText},${age}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARB_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast("Laporan CSV berhasil diunduh");
});

const renderUI = () => {
    let totalDays = 0, count = 0, failCount = 0;
    // Tambahkan init produksi: 0 agar chart tidak error NaN
    const summary = { dates: [], cumulativeCounts: [], targetCounts: [], statusCount: { produksi: 0, active: 0, dead_chip: 0, dead_driver: 0, dead_solder: 0 }, batchAgeData: {} };
    bulbListContainer.innerHTML = '';
    
    const term = searchInput.value.toLowerCase();
    const filter = filterStatus.value;
    let cumulative = 0;

    [...globalDocsData].reverse().forEach((data, i) => {
        cumulative++;
        if (!summary.dates.includes(data.productionDate)) {
            summary.dates.push(data.productionDate);
            summary.cumulativeCounts.push(cumulative);
            summary.targetCounts.push((i + 1) * 1.5);
        } else {
            summary.cumulativeCounts[summary.cumulativeCounts.length-1] = cumulative;
        }
    });

    globalDocsData.forEach((data, index) => {
        const age = data.failedDate ? calculateDays(data.productionDate, data.failedDate) : calculateDays(data.productionDate);
        totalDays += age; count++;
        
        const isDead = data.status.startsWith('dead');
        if (isDead) failCount++;
        
        if (summary.statusCount[data.status] !== undefined) {
            summary.statusCount[data.status]++;
        }
        
        if (!summary.batchAgeData[data.batch]) summary.batchAgeData[data.batch] = { t: 0, c: 0 };
        summary.batchAgeData[data.batch].t += age;
        summary.batchAgeData[data.batch].c += 1;

        const urutan = globalDocsData.length - index;
        const arbCode = `ARB-${String(urutan).padStart(3, '0')}${data.randomSuffix || 'XX'}`;
        
        const matchesSearch = arbCode.toLowerCase().includes(term) || data.batch.toLowerCase().includes(term);
        const matchesStatus = filter === 'all' || 
                              (filter === 'produksi' && data.status === 'produksi') ||
                              (filter === 'active' && data.status === 'active') || 
                              (filter === 'dead' && isDead);

        if (matchesSearch && matchesStatus) {
            let statusBadgeClass = 'status-dead';
            let statusBadgeHTML = '';

            if (data.status === 'produksi') {
                statusBadgeClass = 'status-produksi';
                statusBadgeHTML = `<i class="fa-solid fa-gears"></i> Produksi`;
            } else if (data.status === 'active') {
                statusBadgeClass = 'status-active';
                statusBadgeHTML = `<i class="fa-solid fa-check-double"></i> ${age} Hari`;
            } else {
                statusBadgeClass = 'status-dead';
                statusBadgeHTML = `<i class="fa-solid fa-xmark"></i> Gagal (${age}h)`;
            }

            const item = document.createElement('div');
            item.className = 'bulb-item';
            item.innerHTML = `
                <div class="bulb-item-info">
                    <strong><i class="fa-solid fa-barcode"></i> ${arbCode} | ${data.batch}</strong><br>
                    <small>Prod: ${data.productionDate}</small>
                </div>
                <div class="bulb-item-actions">
                    <span class="status-tag ${statusBadgeClass}">${statusBadgeHTML}</span>
                    <button class="btn-edit" data-id="${data.id}" data-status="${data.status}" data-code="${arbCode}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-delete" data-id="${data.id}"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            bulbListContainer.appendChild(item);
        }
    });

    document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', e => {
        docIdToDelete = e.currentTarget.dataset.id;
        deleteModal.classList.remove('hidden');
        setTimeout(() => deleteModal.classList.add('active'), 10);
    }));

    document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', e => {
        docToEdit = { id: e.currentTarget.dataset.id, old: e.currentTarget.dataset.status };
        document.getElementById('edit-arb-code').innerText = e.currentTarget.dataset.code;
        document.getElementById('edit-status-select').value = docToEdit.old;
        editModal.classList.remove('hidden');
        setTimeout(() => editModal.classList.add('active'), 10);
    }));

    Object.keys(summary.batchAgeData).forEach(b => summary.batchAgeData[b] = Math.round(summary.batchAgeData[b].t / summary.batchAgeData[b].c));
    totalCountEl.innerText = count;
    avgAgeEl.innerText = count > 0 ? Math.round(totalDays/count) + ' Hari' : '0 Hari';
    if(qcFailsEl) qcFailsEl.innerText = count > 0 ? Math.round((failCount/count)*100) + '%' : '0%';
    renderCharts(summary);
};

searchInput.addEventListener('input', renderUI);
filterStatus.addEventListener('change', renderUI);

const closeModals = () => {
    deleteModal.classList.remove('active'); editModal.classList.remove('active');
    setTimeout(() => { deleteModal.classList.add('hidden'); editModal.classList.add('hidden'); }, 300);
};

document.getElementById('btn-cancel-delete').addEventListener('click', closeModals);
document.getElementById('btn-cancel-edit').addEventListener('click', closeModals);

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    await deleteDoc(doc(db, "bulbs", docIdToDelete));
    closeModals(); showToast("Data berhasil dihapus");
});

document.getElementById('btn-confirm-edit').addEventListener('click', async () => {
    const s = document.getElementById('edit-status-select').value;
    const up = { status: s };
    
    const isNewDead = s.startsWith('dead');
    const isOldDead = docToEdit.old.startsWith('dead');

    // Bekukan umur jika status baru adalah gagal, dan status lama bukan gagal
    if (isNewDead && !isOldDead) {
        up.failedDate = new Date().toISOString().split('T')[0];
    } 
    // Lepaskan pembekuan jika status dikembalikan ke produksi / aktif
    else if (!isNewDead) {
        up.failedDate = null;
    }

    await updateDoc(doc(db, "bulbs", docToEdit.id), up);
    closeModals(); showToast("Status QC diperbarui");
});

onSnapshot(query(collection(db, "bulbs"), orderBy("createdAt", "desc")), snap => {
    globalDocsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUI();
});

// --- LIVE DATABASE & NETWORK STATUS ---
const dbStatusEl = document.getElementById('db-status-el');

const updateDBStatus = (isOnline) => {
    if (!dbStatusEl) return;
    if (isOnline) {
        dbStatusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Online (Firestore)';
        dbStatusEl.style.color = 'var(--status-active)';
    } else {
        dbStatusEl.innerHTML = '<i class="fa-solid fa-wifi" style="text-decoration: line-through;"></i> Offline';
        dbStatusEl.style.color = 'var(--status-dead)';
        showToast("Koneksi terputus! Data akan disinkronkan saat online.", true);
    }
};

window.addEventListener('online', () => updateDBStatus(true));
window.addEventListener('offline', () => updateDBStatus(false));
updateDBStatus(navigator.onLine);
