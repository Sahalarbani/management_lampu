/*
  Version: 10.1.3 (Alert Glitch Hotfix)
  Date: 2026-04-11
  Changelog:
  - BUGFIX: Deferred low stock smart alert until the main application container is visible, preventing toasts on the login screen.
*/
import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, updateDoc, doc, orderBy, setDoc, arrayUnion } from "firebase/firestore";
import { showToast, refreshSelectUI, initCustomDropdowns } from './ui.js';
import { logActivity } from './cctv.js';
import { masterVariants, masterPrices, masterKontak } from './admin.js';
import { globalQCData, renderQCUI } from './qc.js';

let localBulbsData = [];
let localKontak = { klien: [], supplier: [] }; 
let activeContactType = 'klien'; 
let hasAlertedLowStock = false; 
let isAlertQueued = false; // Kunci antrian biar gak nyepam
let html5QrCode = null;
let latestStockDocs = []; 

export const renderRekapStok = () => {
    const rc = document.getElementById('rekap-stok-container'); 
    if(!rc) return;

    let inventory = { pcb: {}, cover: {}, ulir: {}, lem: 0 };
    
    if (masterVariants && masterVariants.watt) { masterVariants.watt.forEach(w => { inventory.pcb[w] = 0; inventory.cover[w] = 0; }); }
    if (masterVariants && masterVariants.ulir) { masterVariants.ulir.forEach(u => { inventory.ulir[u] = 0; }); }

    latestStockDocs.forEach(data => { 
        const mult = data.type === 'in' ? 1 : -1; 
        if(data.item === 'lem') { inventory.lem += (data.qty * mult); } 
        else if(data.item === 'pcb' || data.item === 'cover' || data.item === 'ulir') { 
            const v = data.variant;
            if (v) {
                if (inventory[data.item][v] === undefined) inventory[data.item][v] = 0;
                inventory[data.item][v] += (data.qty * mult); 
            }
        } 
    });
    
    if (document.getElementById('stok-lem')) document.getElementById('stok-lem').innerText = `${inventory.lem} Pcs`; 
    renderQCUI(); 
    
    // ==========================================
    // LOGIKA ALERT ANTI GLITCH BOCOR KE LOGIN
    // ==========================================
    if (!hasAlertedLowStock && !isAlertQueued && latestStockDocs.length > 0) {
        let lowItemsCount = 0;
        ['pcb', 'cover', 'ulir'].forEach(cat => { Object.keys(inventory[cat]).forEach(v => { if (inventory[cat][v] < 50) lowItemsCount++; }); });
        if (inventory.lem < 50) lowItemsCount++;
        
        isAlertQueued = true; // Langsung gembok antriannya

        const tryAlert = () => {
            // Cek apakah layar utama udah kebuka (artinya user udah fix di dalam)
            if (document.getElementById('main-app-container').style.display !== 'none') {
                if (lowItemsCount > 0) { 
                    showToast(`! WARNING : Ada ${lowItemsCount} jenis bahan baku yang stoknya di bawah 50 Pcs! Cek Gudang.`, true); 
                }
                hasAlertedLowStock = true;
            } else {
                // Kalau masih di layar login, ngumpet dulu dan cek lagi 1 detik kemudian
                setTimeout(tryAlert, 1000);
            }
        };
        
        // Eksekusi antrian (Kasih delay 1.5 detik biar animasi splash screen selesai)
        setTimeout(tryAlert, 1500);
    }
    
    rc.innerHTML = ''; 
    ['pcb', 'cover', 'ulir'].forEach(cat => { 
        Object.keys(inventory[cat]).forEach(v => { 
            let safeVal = inventory[cat][v] || 0;
            let colorClass = safeVal < 50 ? 'color: var(--status-warning);' : 'color: var(--status-active);';
            if (safeVal <= 0) colorClass = 'color: var(--status-dead);';
            rc.innerHTML += `<div style="background:var(--surface-elevated); padding:15px; border-radius:12px; border:1px solid var(--border-light); display:flex; flex-direction:column; align-items:flex-start; gap:5px;"><div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold;">${cat}</div><div style="font-weight:bold; font-size: 1.1rem; color:var(--text-main);">${v}</div><div style="font-size:1.4rem; font-weight:800; ${colorClass}">${safeVal} Pcs</div></div>`; 
        }); 
    }); 
};

window.addEventListener('masterDataLoaded', renderRekapStok);

export const calculateAutoPrice = () => {
    const item = document.getElementById('stok-item').value; const variant = document.getElementById('stok-variant').value;
    let qty = 0; if (item === 'lampu' && document.getElementById('stok-type').value === 'out') { qty = document.querySelectorAll('.bulb-sale-cb:checked').length; } else { qty = parseInt(document.getElementById('stok-qty').value) || 0; }
    const key = `${item}_${variant}`; const unitPrice = masterPrices[key] || 0; const totalInfo = document.getElementById('unit-price-info');
    if (unitPrice > 0) { document.getElementById('stok-price').value = unitPrice * qty; if(totalInfo) totalInfo.innerText = `@ Rp ${unitPrice}`; } else { document.getElementById('stok-price').value = ''; if(totalInfo) totalInfo.innerText = "Harga Dasar Belum Diset"; }
};

export const renderBulbChecklist = () => {
    const variant = document.getElementById('stok-variant').value; const type = document.getElementById('stok-type').value; const item = document.getElementById('stok-item').value;
    const selectorDiv = document.getElementById('stok-bulb-selector'); const qtyWrapper = document.getElementById('stok-qty-wrapper'); const listDiv = document.getElementById('bulb-checkbox-list');
    
    if (type === 'out' && item === 'lampu' && variant) {
        qtyWrapper.style.display = 'none'; document.getElementById('stok-qty').required = false; selectorDiv.style.display = 'flex';
        const availableBulbs = localBulbsData.filter(b => b.status === 'produksi' && b.watt === variant);
        if (availableBulbs.length === 0) { listDiv.innerHTML = '<p style="font-size:0.85rem; color:var(--status-dead); padding:10px;"><i class="fa-solid fa-triangle-exclamation"></i> Stok Siap Jual Kosong untuk varian ini.</p>'; } else { listDiv.innerHTML = availableBulbs.map(b => `<label class="checkbox-label"><input type="checkbox" class="bulb-sale-cb" value="${b.id}" data-arb="${b.computedArbCode}"><span style="font-weight:bold; color:var(--text-main);">${b.computedArbCode}</span></label>`).join(''); document.querySelectorAll('.bulb-sale-cb').forEach(cb => { cb.addEventListener('change', () => { document.getElementById('selected-bulb-count').innerText = document.querySelectorAll('.bulb-sale-cb:checked').length; calculateAutoPrice(); }); }); } 
        document.getElementById('selected-bulb-count').innerText = '0';
    } else { selectorDiv.style.display = 'none'; qtyWrapper.style.display = 'block'; if (type !== 'out' || item !== 'lampu') document.getElementById('stok-qty').required = true; }
};

const updateContactDropdown = () => {
    const type = document.getElementById('stok-type').value; const item = document.getElementById('stok-item').value; const contactSelect = document.getElementById('stok-contact'); const currentVal = contactSelect.value; 
    contactSelect.innerHTML = '<option value="">Pilih Kontak...</option>';
    if (type === 'out' && item === 'lampu') { if(masterKontak.klien) masterKontak.klien.forEach(k => contactSelect.innerHTML += `<option value="${k}">${k}</option>`); } else if (type === 'in' && item !== 'lampu') { if(masterKontak.supplier) masterKontak.supplier.forEach(s => contactSelect.innerHTML += `<option value="${s}">${s}</option>`); }
    if (currentVal) contactSelect.value = currentVal; 
    initCustomDropdowns(); refreshSelectUI('stok-contact');
};

const handleStokFormDynamic = () => {
    const type = document.getElementById('stok-type').value; const item = document.getElementById('stok-item').value; const variantWrapper = document.getElementById('stok-variant-wrapper'); const variantSelect = document.getElementById('stok-variant'); const finWrapper = document.getElementById('financial-wrapper');
    variantWrapper.style.display = 'none'; variantSelect.required = false; finWrapper.style.display = 'none'; document.getElementById('stok-contact').required = false; document.getElementById('stok-price').required = false; variantSelect.innerHTML = '<option value="">Pilih Varian...</option>';
    if (item === 'pcb' || item === 'cover' || item === 'lampu') { if(masterVariants.watt) masterVariants.watt.forEach(w => variantSelect.innerHTML += `<option value="${w}">${w}</option>`); variantWrapper.style.display = 'block'; variantSelect.required = true; } else if (item === 'ulir') { if(masterVariants.ulir) masterVariants.ulir.forEach(u => variantSelect.innerHTML += `<option value="${u}">${u}</option>`); variantWrapper.style.display = 'block'; variantSelect.required = true; }
    let isFinancial = false; if ((type === 'out' && item === 'lampu') || (type === 'in' && item !== 'lampu')) isFinancial = true; 
    if (isFinancial) { finWrapper.style.display = 'flex'; document.getElementById('stok-contact').required = true; document.getElementById('stok-price').required = true; }
    updateContactDropdown(); initCustomDropdowns(); refreshSelectUI('stok-variant'); renderBulbChecklist(); calculateAutoPrice();
};

export const initStok = () => {
    onSnapshot(query(collection(db, "bulbs"), orderBy("createdAt", "desc")), snap => { const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); localBulbsData = rawDocs.map((d, index) => ({ ...d, computedArbCode: `ARB-${String(rawDocs.length - index).padStart(3, '0')}${d.randomSuffix||'XX'}` })); renderBulbChecklist(); });

    setTimeout(handleStokFormDynamic, 800);
    if(document.getElementById('stok-type')) document.getElementById('stok-type').addEventListener('change', handleStokFormDynamic);
    if(document.getElementById('stok-item')) document.getElementById('stok-item').addEventListener('change', handleStokFormDynamic);
    if(document.getElementById('stok-variant')) document.getElementById('stok-variant').addEventListener('change', () => { renderBulbChecklist(); calculateAutoPrice(); });
    if(document.getElementById('stok-qty')) document.getElementById('stok-qty').addEventListener('input', calculateAutoPrice);

    // KAMERA
    document.getElementById('btn-open-scanner').addEventListener('click', () => {
        document.getElementById('qr-scan-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('qr-scan-modal').classList.add('active'), 10);
        html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, (decodedText, decodedResult) => {
                html5QrCode.stop().then(() => {
                    document.getElementById('qr-scan-modal').classList.remove('active'); setTimeout(() => document.getElementById('qr-scan-modal').classList.add('hidden'), 300);
                    const targetCb = document.querySelector(`.bulb-sale-cb[data-arb="${decodedText}"]`);
                    if (targetCb && !targetCb.checked) { targetCb.checked = true; targetCb.dispatchEvent(new Event('change')); showToast(`BEEP! Lampu ${decodedText} berhasil discan!`); try { const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = audioCtx.createOscillator(); const gainNode = audioCtx.createGain(); oscillator.connect(gainNode); gainNode.connect(audioCtx.destination); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.1); } catch(e){} } else if (targetCb && targetCb.checked) { showToast("Lampu ini sudah di-scan/dipilih!", true); } else { showToast(`Gagal: Kode ${decodedText} tidak ditemukan di stok ini.`, true); }
                }).catch(err => { console.log(err); });
            }, (errorMessage) => { }
        ).catch((err) => { showToast("Gagal mengakses kamera. Izinkan akses kamera browser lu!", true); });
    });

    document.getElementById('btn-close-scanner').addEventListener('click', () => { if (html5QrCode) { html5QrCode.stop().then(() => { document.getElementById('qr-scan-modal').classList.remove('active'); setTimeout(() => document.getElementById('qr-scan-modal').classList.add('hidden'), 300); }).catch(err => { console.log(err); }); } });

    document.getElementById('btn-quick-contact').addEventListener('click', () => { const type = document.getElementById('stok-type').value; const item = document.getElementById('stok-item').value; activeContactType = (type === 'out' && item === 'lampu') ? 'klien' : 'supplier'; document.getElementById('quick-contact-name').placeholder = `Nama ${activeContactType === 'klien' ? 'Klien' : 'Supplier'} Baru...`; document.getElementById('quick-contact-name').value = ''; document.getElementById('quick-contact-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('quick-contact-modal').classList.add('active'), 10); });
    document.getElementById('btn-cancel-quick-contact').addEventListener('click', () => { document.getElementById('quick-contact-modal').classList.remove('active'); setTimeout(() => document.getElementById('quick-contact-modal').classList.add('hidden'), 300); });
    document.getElementById('quick-contact-form').addEventListener('submit', async (e) => { e.preventDefault(); const newName = document.getElementById('quick-contact-name').value.trim(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await setDoc(doc(db, "settings", "master_kontak"), { [activeContactType]: arrayUnion(newName) }, { merge: true }); logActivity(`[STOK] Menambahkan ${activeContactType} baru: ${newName}`); showToast("Kontak berhasil ditambah!"); document.getElementById('btn-cancel-quick-contact').click(); setTimeout(() => { const contactSelect = document.getElementById('stok-contact'); contactSelect.value = newName; refreshSelectUI('stok-contact'); }, 600); } catch(err) { showToast("Gagal menambah kontak", true); } finally { btn.innerHTML = 'Simpan'; btn.disabled = false; } });

    const form = document.getElementById('stok-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); const type = document.getElementById('stok-type').value; const item = document.getElementById('stok-item').value; const variant = document.getElementById('stok-variant').value || null; const date = new Date().toISOString(); const isSale = (type === 'out' && item === 'lampu'); 
            let qty = 0; let bulbsToAutoUpdate = []; let arbCodesStr = [];

            if (isSale) { if(!variant) return showToast("Pilih varian!", true); const checkedBoxes = document.querySelectorAll('.bulb-sale-cb:checked'); qty = checkedBoxes.length; if (qty === 0) return showToast("Scan/Pilih KTP Lampu (ARB) yang mau dijual!", true); checkedBoxes.forEach(cb => { bulbsToAutoUpdate.push(cb.value); arbCodesStr.push(cb.dataset.arb); }); } else { qty = parseInt(document.getElementById('stok-qty').value); }

            const btn = e.target.querySelector('button[type="submit"]'); const origBtnHtml = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...'; btn.disabled = true;
            try {
                await addDoc(collection(db, "stock_history"), { item, variant, type, qty, createdAt: new Date() });
                if (document.getElementById('financial-wrapper').style.display === 'flex') { const totalRp = parseInt(document.getElementById('stok-price').value); const statusBayar = document.getElementById('stok-payment').value; const contact = document.getElementById('stok-contact').value; let ledgerType = ''; if (isSale) ledgerType = (statusBayar === 'lunas') ? 'income' : 'receivable'; else ledgerType = (statusBayar === 'lunas') ? 'expense' : 'payable'; const ket = isSale && qty <= 3 ? `Jual ${qty}pcs ${variant} (${arbCodesStr.join(', ')})` : (isSale ? `Jual ${qty}pcs Lampu ${variant}` : `Beli ${qty}pcs ${item.toUpperCase()} ${variant||''}`); await addDoc(collection(db, "finance_ledger"), { type: ledgerType, amount: totalRp, paidAmount: 0, contact: contact, ref: ket, date: date.split('T')[0], createdAt: new Date() }); if (isSale) { logActivity(`[STOK] Jual ${qty} Lampu (${variant}) ke ${contact}. Total Rp ${totalRp} (${statusBayar}). Serial: [${arbCodesStr.join(', ')}]`); } else { logActivity(`[STOK] Beli ${qty} ${item.toUpperCase()} ${variant||''} dari ${contact}. Total Rp ${totalRp} (${statusBayar}).`); } } else { logActivity(`[STOK] Transaksi Manual: ${type === 'in' ? 'Masuk' : 'Keluar'} ${qty} ${item.toUpperCase()} ${variant||''}`); }

                if (isSale && bulbsToAutoUpdate.length > 0) { for (const docId of bulbsToAutoUpdate) await updateDoc(doc(db, "bulbs", docId), { status: 'active' }); }
                e.target.reset(); handleStokFormDynamic(); showToast("Transaksi Berhasil Dieksekusi!");
            } catch (error) { showToast("Gagal menyimpan transaksi", true); } finally { btn.innerHTML = origBtnHtml; btn.disabled = false; }
        });
    }

    onSnapshot(query(collection(db, "stock_history")), snap => {
        latestStockDocs = snap.docs.map(d => d.data()); 
        renderRekapStok(); 
    });
};
