/*
  Version: 1.8.0
  Date: 2026-04-07
  Changelog:
  - Added showToast utility for professional user feedback.
  - Integrated PWA registration logic.
  - Global event handling for Search, Filter, Export, and CRUD.
*/
import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { renderCharts } from './charts.js';

// --- TOAST SYSTEM ---
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
    globalDocsData.forEach((data, index) => {
        const urutan = globalDocsData.length - index;
        const code = `ARB-${String(urutan).padStart(3, '0')}${data.randomSuffix || 'XX'}`;
        const age = data.failedDate ? calculateDays(data.productionDate, data.failedDate) : calculateDays(data.productionDate);
        csvContent += `${code},${data.batch},${data.productionDate},${data.status},${age}\n`;
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
    const summary = { dates: [], cumulativeCounts: [], targetCounts: [], statusCount: { active: 0, dead_chip: 0, dead_driver: 0, dead_solder: 0 }, batchAgeData: {} };
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
        if (data.status !== 'active') failCount++;
        summary.statusCount[data.status]++;
        
        if (!summary.batchAgeData[data.batch]) summary.batchAgeData[data.batch] = { t: 0, c: 0 };
        summary.batchAgeData[data.batch].t += age;
        summary.batchAgeData[data.batch].c += 1;

        const urutan = globalDocsData.length - index;
        const arbCode = `ARB-${String(urutan).padStart(3, '0')}${data.randomSuffix || 'XX'}`;
        
        if ((arbCode.toLowerCase().includes(term) || data.batch.toLowerCase().includes(term)) && (filter === 'all' || (filter === 'active' && data.status === 'active') || (filter === 'dead' && data.status !== 'active'))) {
            const item = document.createElement('div');
            item.className = 'bulb-item';
            item.innerHTML = `
                <div class="bulb-item-info">
                    <strong><i class="fa-solid fa-barcode"></i> ${arbCode} | ${data.batch}</strong><br>
                    <small>Prod: ${data.productionDate}</small>
                </div>
                <div class="bulb-item-actions">
                    <span class="status-tag ${data.status !== 'active' ? 'status-dead' : 'status-active'}">
                        ${data.status !== 'active' ? 'Gagal ('+age+'h)' : age + ' Hari'}
                    </span>
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
    if (s !== 'active' && docToEdit.old === 'active') up.failedDate = new Date().toISOString().split('T')[0];
    else if (s === 'active') up.failedDate = null;
    await updateDoc(doc(db, "bulbs", docToEdit.id), up);
    closeModals(); showToast("Status QC diperbarui");
});

onSnapshot(query(collection(db, "bulbs"), orderBy("createdAt", "desc")), snap => {
    globalDocsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUI();
});
