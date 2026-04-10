/*
  Version: 9.1.0
  Date: 2026-04-11
  Changelog:
  - FEATURE: Implemented direct com.android.bips trigger via window.print() and DOM manipulation.
*/

import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { showToast, refreshSelectUI } from './ui.js';
import { logActivity } from './cctv.js';
import { renderCharts } from './charts.js';
import { masterVariants } from './admin.js';

export let globalQCData = []; 
let docIdToDelete = null; let docToEdit = null; let arbCodeTemp = null; let oldStatusTemp = null; let oldWattTemp = null;

const calculateDays = (start, end = new Date()) => { const s=new Date(start); const e=new Date(end); s.setHours(0,0,0,0); e.setHours(0,0,0,0); return Math.ceil(Math.abs(e-s)/86400000); };
const generateRandomSuffix = () => { const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return c[Math.floor(Math.random()*26)]+c[Math.floor(Math.random()*26)]; };

export const renderQCUI = () => {
    let totalDays=0, countActive=0, countAll=0, failCount=0, countProduksi=0, failChip=0, failDriver=0, failSolder=0;
    const listC = document.getElementById('bulb-list-container'); if (listC) listC.innerHTML = '';
    const summary = { dates:[], cumulativeCounts:[], targetCounts:[], statusCount:{produksi:0, active:0, dead_chip:0, dead_driver:0, dead_solder:0}, batchAgeData:{} };
    const term = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : ''; const filter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';

    [...globalQCData].reverse().forEach((data, i) => { if (!summary.dates.includes(data.productionDate)) { summary.dates.push(data.productionDate); summary.cumulativeCounts.push(i+1); summary.targetCounts.push((i+1)*1.5); } else { summary.cumulativeCounts[summary.cumulativeCounts.length-1] = i+1; } });
    
    globalQCData.forEach((data) => {
        let age = 0; if(data.status !== 'produksi') age = calculateDays(data.productionDate, data.failedDate || new Date());
        countAll++; if (data.status === 'active') { countActive++; totalDays += age; } if (data.status === 'produksi') { countProduksi++; }
        const isDead = data.status.startsWith('dead'); if (isDead) { failCount++; if(data.status==='dead_chip') failChip++; if(data.status==='dead_driver') failDriver++; if(data.status==='dead_solder') failSolder++; }
        if (summary.statusCount[data.status] !== undefined) summary.statusCount[data.status]++;
        if (!summary.batchAgeData[data.batch]) summary.batchAgeData[data.batch] = { t:0, c:0 }; summary.batchAgeData[data.batch].t += age; summary.batchAgeData[data.batch].c += 1;
        
        const arbCode = data.computedArbCode;
        if ((arbCode.toLowerCase().includes(term) || data.batch.toLowerCase().includes(term)) && (filter === 'all' || (filter === 'produksi' && data.status === 'produksi') || (filter === 'active' && data.status === 'active') || (filter === 'dead' && isDead)) && listC) {
            let badgeClass = 'status-dead'; let badgeHTML = `<i class="fa-solid fa-xmark"></i> Gagal (${age}h)`; 
            if (data.status === 'produksi') { badgeClass = 'status-produksi'; badgeHTML = `<i class="fa-solid fa-gears"></i> Produksi`; } else if (data.status === 'active') { badgeClass = 'status-active'; badgeHTML = `<i class="fa-solid fa-check-double"></i> ${age} Hari`; } 
            listC.innerHTML += `<div class="bulb-item"><div class="bulb-item-info"><strong><i class="fa-solid fa-barcode"></i> ${arbCode} | ${data.batch} | <span style="color:var(--status-produksi);">${data.watt||'N/A'}</span></strong><br><small style="color:var(--text-muted);">Prod: ${data.productionDate}</small></div><div class="bulb-item-actions"><span class="status-tag ${badgeClass}">${badgeHTML}</span><button class="btn-outline btn-print-qr admin-only" data-code="${arbCode}" title="Cetak QR"><i class="fa-solid fa-qrcode"></i></button><button class="btn-edit admin-only" data-id="${data.id}" data-status="${data.status}" data-code="${arbCode}" data-watt="${data.watt||''}"><i class="fa-solid fa-pen"></i></button><button class="btn-delete admin-only" data-code="${arbCode}" data-id="${data.id}"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
        }
    });

    Object.keys(summary.batchAgeData).forEach(b => summary.batchAgeData[b] = Math.round(summary.batchAgeData[b].t / summary.batchAgeData[b].c));
    if(document.getElementById('total-active')) document.getElementById('total-active').innerText = countActive; if(document.getElementById('avg-age-value')) document.getElementById('avg-age-value').innerText = countActive > 0 ? Math.round(totalDays/countActive) + ' Hari' : '0 Hari'; if(document.getElementById('qc-fail-percentage')) document.getElementById('qc-fail-percentage').innerText = countAll > 0 ? Math.round((failCount/countAll)*100) + '%' : '0%';
    if(document.getElementById('stok-lampu-jadi')) document.getElementById('stok-lampu-jadi').innerText = `${countProduksi} Pcs`; if(document.getElementById('stok-lampu-gagal')) document.getElementById('stok-lampu-gagal').innerText = `${failCount} Pcs`; if(document.getElementById('fail-chip')) document.getElementById('fail-chip').innerText = failChip; if(document.getElementById('fail-driver')) document.getElementById('fail-driver').innerText = failDriver; if(document.getElementById('fail-solder')) document.getElementById('fail-solder').innerText = failSolder;
    
    attachModalListeners(); 
    import('./auth.js').then(module => { document.querySelectorAll('.admin-only').forEach(el => { el.style.display = (module.currentUserRole === 'admin') ? '' : 'none'; }); });
    if(typeof renderCharts === 'function') renderCharts(summary); 
};

const attachModalListeners = () => {
    document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', e => { docIdToDelete = e.currentTarget.dataset.id; arbCodeTemp = e.currentTarget.dataset.code; document.getElementById('custom-delete-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('custom-delete-modal').classList.add('active'), 10); }));
    document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', e => { docToEdit = { id: e.currentTarget.dataset.id, old: e.currentTarget.dataset.status }; arbCodeTemp = e.currentTarget.dataset.code; oldStatusTemp = e.currentTarget.dataset.status; oldWattTemp = e.currentTarget.dataset.watt; const codeEl = document.getElementById('edit-arb-code'); if(codeEl) codeEl.innerText = arbCodeTemp; document.getElementById('edit-status-select').value = docToEdit.old; document.getElementById('edit-bulb-watt').value = oldWattTemp || ''; refreshSelectUI('edit-status-select'); refreshSelectUI('edit-bulb-watt'); document.getElementById('edit-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('edit-modal').classList.add('active'), 10); }));

    document.querySelectorAll('.btn-print-qr').forEach(b => b.addEventListener('click', e => {
        arbCodeTemp = e.currentTarget.dataset.code;
        document.getElementById('qr-title-code').innerText = arbCodeTemp;
        
        new QRious({
            element: document.getElementById('qr-canvas'),
            value: arbCodeTemp,
            size: 200,
            background: 'white',
            foreground: 'black'
        });

        document.getElementById('qr-print-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('qr-print-modal').classList.add('active'), 10);
    }));
};

const closeModals = () => { document.querySelectorAll('.modal-overlay').forEach(m => { m.classList.remove('active'); setTimeout(() => m.classList.add('hidden'), 300); }); };

export const initQC = () => {
    onSnapshot(query(collection(db, "bulbs"), orderBy("createdAt", "desc")), snap => { const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); globalQCData = rawDocs.map((d, index) => ({ ...d, computedArbCode: `ARB-${String(rawDocs.length - index).padStart(3, '0')}${d.randomSuffix||'XX'}` })); renderQCUI(); const sItem = document.getElementById('stok-item'); const sType = document.getElementById('stok-type'); if (sItem && sItem.value === 'lampu' && sType && sType.value === 'out') { import('./stok.js').then(m => { if(m.renderBulbChecklist) m.renderBulbChecklist(); }); } });

    const form = document.getElementById('bulb-form');
    if (form) {
        form.addEventListener('submit', async (e) => { 
            e.preventDefault(); const batch = document.getElementById('bulb-batch').value; const watt = document.getElementById('bulb-watt').value; const status = document.getElementById('bulb-status').value; const btn = e.target.querySelector('button'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auto-Deduct...'; btn.disabled = true;
            try { 
                await addDoc(collection(db, "bulbs"), { batch, watt, productionDate: document.getElementById('prod-date').value, status, randomSuffix: generateRandomSuffix(), createdAt: new Date() });
                const defaultUlir = (masterVariants && masterVariants.ulir && masterVariants.ulir.length > 0) ? masterVariants.ulir[0] : 'E27';
                const bomComponents = [ { item: 'pcb', variant: watt, type: 'out', qty: 1 }, { item: 'cover', variant: watt, type: 'out', qty: 1 }, { item: 'ulir', variant: defaultUlir, type: 'out', qty: 1 }, { item: 'lem', variant: null, type: 'out', qty: 1 } ];
                for (const comp of bomComponents) { await addDoc(collection(db, "stock_history"), { ...comp, createdAt: new Date(), notes: `Auto-Deduct Produksi QC (${batch})` }); }
                logActivity(`[SISTEM] Produksi 1pcs ${watt} (Batch: ${batch}). Bahan otomatis dipotong.`); e.target.reset(); refreshSelectUI('bulb-watt'); refreshSelectUI('bulb-status'); showToast("Produksi Dicatat & Bahan Dipotong!");
            } catch (err) { showToast("Gagal menyimpan data", true); } finally { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Data QC'; btn.disabled = false; }
        });
    }

    if(document.getElementById('search-input')) document.getElementById('search-input').addEventListener('input', renderQCUI);
    if(document.getElementById('filter-status')) document.getElementById('filter-status').addEventListener('change', renderQCUI);
    document.querySelectorAll('#btn-cancel-delete, #btn-cancel-edit, #btn-close-qr').forEach(b => b.addEventListener('click', closeModals));

    // ==========================================
    // LOGIKA TRIGGER BIPS ANDROID PRINTER (window.print)
    // ==========================================
    document.getElementById('btn-print-thermal').addEventListener('click', () => {
        const qrCanvas = document.getElementById('qr-canvas');
        const dataUrl = qrCanvas.toDataURL(); 
        const printArea = document.getElementById('print-area');
        
        // Render ke brankas rahasia
        printArea.innerHTML = `
            <div style="width: 100%; text-align: center; font-family: monospace;">
                <h3 style="margin: 0; font-size: 16px;">KTP LAMPU</h3>
                <h1 style="margin: 5px 0; font-size: 20px; font-weight: bold;">${arbCodeTemp}</h1>
                <img src="${dataUrl}" style="width: 160px; height: 160px; display: block; margin: 0 auto;">
                <p style="font-size: 12px; margin-top: 5px;">LED DOB ERP</p>
            </div>
        `;
        
        // Panggil sistem Print Android (com.android.bips)
        window.print();
        
        // Opsional: Bersihin setelah nge-print
        setTimeout(() => { printArea.innerHTML = ''; closeModals(); }, 1000);
    });

    if (document.getElementById('btn-confirm-delete')) document.getElementById('btn-confirm-delete').addEventListener('click', async () => { await deleteDoc(doc(db, "bulbs", docIdToDelete)); logActivity(`[QC] Menghapus data QC Lampu: ${arbCodeTemp}`); closeModals(); showToast("Data dihapus"); });
    if (document.getElementById('btn-confirm-edit')) document.getElementById('btn-confirm-edit').addEventListener('click', async () => { const s = document.getElementById('edit-status-select').value; const w = document.getElementById('edit-bulb-watt').value; const up = { status: s }; if (w) up.watt = w; const isNewDead = s.startsWith('dead'); const isOldDead = docToEdit.old.startsWith('dead'); if (isNewDead && !isOldDead) { up.failedDate = new Date().toISOString().split('T')[0]; } else if (!isNewDead) { up.failedDate = null; } await updateDoc(doc(db, "bulbs", docToEdit.id), up); logActivity(`[QC] Edit data ${arbCodeTemp}. Status: ${s}`); closeModals(); showToast("QC diperbarui"); });
};
