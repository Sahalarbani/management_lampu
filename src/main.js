/*
  Version: 6.1.2-ERP
  Date: 2026-04-10
  Changelog:
  - FIXED: Added explicit zIndex 999999 to toast container to override login screen overlay.
  - FIXED: Implemented native alert() inside Firebase Auth catch block to expose silent IndexedDB errors on restricted browsers.
  - REFACTOR: Removed all unicode emojis from strings and comments to ensure strict parser compatibility.
*/

import { auth, db } from './firebase.js'; 
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { renderCharts } from './charts.js';

// ==========================================
// 0. SECURITY, AUTH, & LOGGING CORE
// ==========================================
export let currentUserEmail = null;

window.showToast = (msg, isErr=false) => {
    let c = document.querySelector('.toast-container'); 
    if(!c){ 
        c = document.createElement('div'); 
        c.className='toast-container'; 
        c.style.zIndex = '999999'; 
        document.body.appendChild(c); 
    }
    const t = document.createElement('div'); 
    t.className = `toast ${isErr?'error':''}`; 
    t.innerHTML = `<i class="fa-solid ${isErr?'fa-circle-xmark':'fa-circle-check'}"></i> ${msg}`;
    c.appendChild(t); 
    setTimeout(()=>t.classList.add('show'), 100); 
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 3000);
};

// Global Logger (CCTV) yang Lebih Detail
window.logActivity = async (actionDesc) => {
    if(!currentUserEmail) return;
    try {
        await addDoc(collection(db, "system_logs"), {
            actor: currentUserEmail, action: actionDesc, timestamp: new Date().toISOString()
        });
    } catch(e) { 
        console.error("Gagal catat CCTV log", e); 
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserEmail = user.email;
        document.getElementById('login-screen').classList.remove('active'); 
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app-container').style.display = 'block'; 
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-email').innerText = user.email;
    } else {
        currentUserEmail = null;
        document.getElementById('main-app-container').style.display = 'none';
        document.getElementById('login-screen').classList.remove('hidden'); 
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('user-info').style.display = 'none';
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const em = document.getElementById('login-email').value; 
    const pw = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button'); 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    
    try { 
        await signInWithEmailAndPassword(auth, em, pw); 
        window.showToast("Login Sukses!"); 
        window.logActivity("[AUTH] Berhasil Login ke dalam sistem ERP."); 
    } catch(err) { 
        alert("INFO ERROR: " + err.code + " | " + err.message);
        window.showToast("Akses Ditolak: " + err.code, true); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Buka Brankas'; 
    }
});

document.getElementById('btn-logout').addEventListener('click', () => { 
    window.logActivity("[AUTH] Logout dari sistem ERP."); 
    signOut(auth); 
});

document.getElementById('btn-open-cctv').addEventListener('click', (e) => { 
    e.preventDefault(); 
    document.getElementById('cctv-modal').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('cctv-modal').classList.add('active'), 10); 
});

document.getElementById('btn-close-cctv').addEventListener('click', () => { 
    document.getElementById('cctv-modal').classList.remove('active'); 
    setTimeout(() => document.getElementById('cctv-modal').classList.add('hidden'), 300); 
});

onSnapshot(query(collection(db, "system_logs"), orderBy("timestamp", "desc")), snap => {
    const list = document.getElementById('cctv-list'); 
    if(!list) return; 
    list.innerHTML = '';
    snap.docs.forEach(doc => {
        const d = doc.data(); 
        const t = new Date(d.timestamp).toLocaleString('id-ID');
        list.innerHTML += `<div style="padding: 12px; border-bottom: 1px solid var(--border-light); font-size: 0.85rem; line-height: 1.4;">
            <div style="color: var(--text-muted); margin-bottom: 5px; font-size: 0.75rem;">${t} | <span style="color: var(--accent-primary); font-weight: bold;"><i class="fa-solid fa-user-shield"></i> ${d.actor}</span></div>
            <div style="color: var(--text-main);"><i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.7rem; margin-right: 5px;"></i> ${d.action}</div></div>`;
    });
});

window.initCustomDropdowns = () => {
    document.querySelectorAll('select').forEach(sel => {
        if (sel.dataset.customized || sel.style.display === 'none') return;
        sel.dataset.customized = "true"; 
        sel.style.display = "none";
        const w = document.createElement("div"); 
        w.className = "custom-dropdown"; 
        if(sel.style.flex) w.style.flex = sel.style.flex;
        const sd = document.createElement("div"); 
        sd.className = "custom-dropdown-selected"; 
        const od = document.createElement("div"); 
        od.className = "custom-dropdown-options";
        w.appendChild(sd); w.appendChild(od); 
        sel.parentNode.insertBefore(w, sel.nextSibling);
        const ro = () => {
            od.innerHTML = ""; 
            let st = "Pilih...";
            Array.from(sel.options).forEach((opt, i) => { 
                if(sel.selectedIndex === i) st = opt.text;
                const d = document.createElement("div"); 
                d.className = "custom-dropdown-option" + (sel.selectedIndex === i ? " selected" : ""); 
                d.innerText = opt.text;
                d.addEventListener("click", () => { 
                    sel.selectedIndex = i; 
                    sel.dispatchEvent(new Event('change')); 
                    od.classList.remove("show"); 
                    ro(); 
                }); 
                od.appendChild(d);
            }); 
            sd.innerHTML = `<span>${st}</span><i class="fa-solid fa-chevron-down"></i>`;
        };
        sd.addEventListener("click", (e) => { 
            e.stopPropagation(); 
            document.querySelectorAll('.custom-dropdown-options').forEach(el=>{
                if(el!==od) el.classList.remove('show');
            }); 
            od.classList.toggle("show"); 
        }); 
        sel.refreshCustomUI = ro; 
        ro();
    });
};

document.addEventListener("click", () => document.querySelectorAll('.custom-dropdown-options').forEach(el => el.classList.remove('show'))); 
window.refreshSelectUI = (id) => { 
    const el = document.getElementById(id); 
    if(el && el.refreshCustomUI) el.refreshCustomUI(); 
};

const handleRouting = () => {
    const hash = window.location.hash || '#/qc';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    if (hash === '#/stok') { 
        document.getElementById('nav-stok').classList.add('active'); 
        document.getElementById('page-stok').classList.remove('hidden'); 
    } else if (hash === '#/keuangan') { 
        document.getElementById('nav-keuangan').classList.add('active'); 
        document.getElementById('page-keuangan').classList.remove('hidden'); 
    } else { 
        document.getElementById('nav-qc').classList.add('active'); 
        document.getElementById('page-qc').classList.remove('hidden'); 
    }
};

window.addEventListener('hashchange', handleRouting); 
window.addEventListener('DOMContentLoaded', () => { 
    handleRouting(); 
    window.initCustomDropdowns(); 
});

// ==========================================
// 1. MASTER DATA LOGIC
// ==========================================
let masterVariants = { watt: [], ulir: [] }; 
let masterPrices = {}; 
export let masterKontak = { klien: [], supplier: [] };

onSnapshot(doc(db, "settings", "master_variants"), (docSnap) => {
    if (docSnap.exists()) {
        masterVariants = docSnap.data(); 
    } else {
        setDoc(doc(db, "settings", "master_variants"), { watt: ['5W'], ulir: ['E27'] }, { merge: true });
    }
    const updateVS = (id) => { 
        const sel = document.getElementById(id); 
        if(!sel) return; 
        const cur = sel.value; 
        sel.innerHTML = '<option value="">Pilih Watt...</option>'; 
        masterVariants.watt.forEach(w => sel.innerHTML += `<option value="${w}">${w}</option>`); 
        sel.value = cur; 
        window.refreshSelectUI(id); 
    };
    updateVS('bulb-watt'); 
    updateVS('edit-bulb-watt');
    
    const priceVarSel = document.getElementById('price-variant');
    if(priceVarSel) { 
        const pItem = document.getElementById('price-item').value; 
        priceVarSel.innerHTML = '<option value="">Varian...</option>'; 
        if(pItem === 'pcb' || pItem === 'lampu' || pItem === 'cover') {
            masterVariants.watt.forEach(w => priceVarSel.innerHTML += `<option value="${w}">${w}</option>`); 
        } else if(pItem === 'ulir') {
            masterVariants.ulir.forEach(u => priceVarSel.innerHTML += `<option value="${u}">${u}</option>`); 
        }
        window.refreshSelectUI('price-variant'); 
    }

    const c = document.getElementById('variant-tags-container');
    if(c) { 
        c.innerHTML = ''; 
        masterVariants.watt.forEach(w => c.innerHTML += `<span class="status-tag" style="background:var(--accent-primary);"><i class="fa-solid fa-bolt"></i> ${w}</span>`); 
        masterVariants.ulir.forEach(u => c.innerHTML += `<span class="status-tag" style="background:var(--text-muted);"><i class="fa-solid fa-circle-notch"></i> ${u}</span>`); 
    }
});

if(document.getElementById('price-item')) { 
    document.getElementById('price-item').addEventListener('change', (e) => {
        const pItem = e.target.value; 
        const priceVarSel = document.getElementById('price-variant'); 
        priceVarSel.innerHTML = '<option value="">Varian...</option>';
        if(pItem === 'pcb' || pItem === 'lampu' || pItem === 'cover') {
            masterVariants.watt.forEach(w => priceVarSel.innerHTML += `<option value="${w}">${w}</option>`); 
        } else if(pItem === 'ulir') {
            masterVariants.ulir.forEach(u => priceVarSel.innerHTML += `<option value="${u}">${u}</option>`); 
        }
        window.refreshSelectUI('price-variant');
    });
}

document.getElementById('variant-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const v = document.getElementById('new-variant-val').value.trim().toUpperCase(); 
    const t = document.getElementById('new-variant-type').value; 
    if(v) { 
        const btn = e.target.querySelector('button'); 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        btn.disabled = true;
        try { 
            await setDoc(doc(db, "settings", "master_variants"), { [t]: arrayUnion(v) }, { merge: true }); 
            window.logActivity(`[MASTER] Menambahkan Varian Baru: ${v} (${t})`); 
            document.getElementById('new-variant-val').value = ''; 
            window.showToast("Varian ditambah!");
        } catch (error) { 
            window.showToast("Gagal", true); 
        } finally { 
            btn.innerHTML = '<i class="fa-solid fa-plus"></i>'; 
            btn.disabled = false; 
        } 
    }
});

onSnapshot(doc(db, "settings", "master_prices"), (docSnap) => {
    if (docSnap.exists()) masterPrices = docSnap.data();
    const pc = document.getElementById('price-list-container');
    if(pc) { 
        pc.innerHTML = ''; 
        Object.keys(masterPrices).forEach(key => { 
            pc.innerHTML += `<div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid var(--border-light);"><span style="font-weight:bold;">${key.replace('_', ' ').toUpperCase()}</span><span style="color:var(--status-active);">Rp ${masterPrices[key]}</span></div>`; 
        }); 
    }
});

document.getElementById('price-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const itm = document.getElementById('price-item').value; 
    const vnt = document.getElementById('price-variant').value; 
    const val = parseInt(document.getElementById('price-val').value);
    if(itm && vnt && val >= 0) {
        try { 
            await setDoc(doc(db, "settings", "master_prices"), { [`${itm}_${vnt}`]: val }, { merge: true }); 
            window.logActivity(`[MASTER] Mengatur Harga Dasar untuk ${itm.toUpperCase()} (${vnt}) menjadi Rp ${val}`); 
            window.showToast("Harga diupdate!"); 
        } catch (error) { 
            window.showToast("Gagal", true); 
        }
    }
});

onSnapshot(doc(db, "settings", "master_kontak"), (docSnap) => { 
    if (docSnap.exists()) masterKontak = docSnap.data(); 
});

document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const nama = document.getElementById('new-contact-name').value.trim(); 
    const tipe = document.getElementById('new-contact-type').value; 
    if(nama) { 
        const btn = e.target.querySelector('button'); 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        btn.disabled = true;
        try { 
            await setDoc(doc(db, "settings", "master_kontak"), { [tipe]: arrayUnion(nama) }, { merge: true }); 
            window.logActivity(`[MASTER] Mendaftarkan Kontak Baru: ${nama} sebagai ${tipe.toUpperCase()}`); 
            document.getElementById('new-contact-name').value = ''; 
            window.showToast("Kontak ditambahkan!");
        } catch (err) { 
            window.showToast("Gagal", true); 
        } finally { 
            btn.innerHTML = '<i class="fa-solid fa-plus"></i>'; 
            btn.disabled = false; 
        } 
    }
});

// ==========================================
// 2. QC & STOK LOGIC
// ==========================================
let globalQCData = []; 
const calculateDays = (start, end = new Date()) => { 
    const s=new Date(start); const e=new Date(end); 
    s.setHours(0,0,0,0); e.setHours(0,0,0,0); 
    return Math.ceil(Math.abs(e-s)/86400000); 
};
const generateRandomSuffix = () => { 
    const c='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
    return c[Math.floor(Math.random()*26)]+c[Math.floor(Math.random()*26)]; 
};

if (document.getElementById('bulb-form')) {
    document.getElementById('bulb-form').addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const batch = document.getElementById('bulb-batch').value; 
        const watt = document.getElementById('bulb-watt').value; 
        const status = document.getElementById('bulb-status').value;
        try { 
            await addDoc(collection(db, "bulbs"), { 
                batch, watt, productionDate: document.getElementById('prod-date').value, status, randomSuffix: generateRandomSuffix(), createdAt: new Date() 
            });
            window.logActivity(`[QC - INPUT] Menginput Produksi Baru | Batch: ${batch} | Varian: ${watt} | Status Awal: ${status}`); 
            e.target.reset(); 
            window.refreshSelectUI('bulb-watt'); 
            window.refreshSelectUI('bulb-status'); 
            window.showToast("QC disimpan!");
        } catch (err) { 
            window.showToast("Gagal", true); 
        } 
    });
}

const renderQCUI = () => {
    let totalDays=0, countActive=0, countAll=0, failCount=0, countProduksi=0, failChip=0, failDriver=0, failSolder=0;
    const listC = document.getElementById('bulb-list-container'); 
    if (listC) listC.innerHTML = '';
    const summary = { dates:[], cumulativeCounts:[], targetCounts:[], statusCount:{produksi:0, active:0, dead_chip:0, dead_driver:0, dead_solder:0}, batchAgeData:{} };
    const term = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : ''; 
    const filter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';

    [...globalQCData].reverse().forEach((data, i) => { 
        if (!summary.dates.includes(data.productionDate)) { 
            summary.dates.push(data.productionDate); 
            summary.cumulativeCounts.push(i+1); 
            summary.targetCounts.push((i+1)*1.5); 
        } else { 
            summary.cumulativeCounts[summary.cumulativeCounts.length-1] = i+1; 
        } 
    });
    
    globalQCData.forEach((data) => {
        let age = 0; 
        if(data.status !== 'produksi') age = calculateDays(data.productionDate, data.failedDate || new Date());
        countAll++; 
        if (data.status === 'active') { countActive++; totalDays += age; } 
        if (data.status === 'produksi') { countProduksi++; }
        
        const isDead = data.status.startsWith('dead'); 
        if (isDead) { 
            failCount++; 
            if(data.status==='dead_chip') failChip++; 
            if(data.status==='dead_driver') failDriver++; 
            if(data.status==='dead_solder') failSolder++; 
        }
        if (summary.statusCount[data.status] !== undefined) summary.statusCount[data.status]++;
        if (!summary.batchAgeData[data.batch]) summary.batchAgeData[data.batch] = { t:0, c:0 }; 
        summary.batchAgeData[data.batch].t += age; 
        summary.batchAgeData[data.batch].c += 1;
        
        const arbCode = data.computedArbCode;
        if ((arbCode.toLowerCase().includes(term) || data.batch.toLowerCase().includes(term)) && (filter === 'all' || (filter === 'produksi' && data.status === 'produksi') || (filter === 'active' && data.status === 'active') || (filter === 'dead' && isDead)) && listC) {
            let badgeClass = 'status-dead';
            let badgeHTML = `<i class="fa-solid fa-xmark"></i> Gagal (${age}h)`; 
            if (data.status === 'produksi') { 
                badgeClass = 'status-produksi'; 
                badgeHTML = `<i class="fa-solid fa-gears"></i> Produksi`; 
            } else if (data.status === 'active') { 
                badgeClass = 'status-active'; 
                badgeHTML = `<i class="fa-solid fa-check-double"></i> ${age} Hari`; 
            } 
            listC.innerHTML += `<div class="bulb-item"><div class="bulb-item-info"><strong><i class="fa-solid fa-barcode"></i> ${arbCode} | ${data.batch} | <span style="color:var(--status-produksi);">${data.watt||'N/A'}</span></strong><br><small>Prod: ${data.productionDate}</small></div><div class="bulb-item-actions"><span class="status-tag ${badgeClass}">${badgeHTML}</span><button class="btn-edit" data-id="${data.id}" data-status="${data.status}" data-code="${arbCode}" data-watt="${data.watt||''}"><i class="fa-solid fa-pen"></i></button><button class="btn-delete" data-code="${arbCode}" data-id="${data.id}"><i class="fa-solid fa-trash-can"></i></button></div></div>`;
        }
    });

    Object.keys(summary.batchAgeData).forEach(b => summary.batchAgeData[b] = Math.round(summary.batchAgeData[b].t / summary.batchAgeData[b].c));
    if(document.getElementById('total-active')) document.getElementById('total-active').innerText = countActive; 
    if(document.getElementById('avg-age-value')) document.getElementById('avg-age-value').innerText = countActive > 0 ? Math.round(totalDays/countActive) + ' Hari' : '0 Hari';
    if(document.getElementById('qc-fail-percentage')) document.getElementById('qc-fail-percentage').innerText = countAll > 0 ? Math.round((failCount/countAll)*100) + '%' : '0%';
    if(document.getElementById('stok-lampu-jadi')) document.getElementById('stok-lampu-jadi').innerText = `${countProduksi} Pcs`; 
    if(document.getElementById('stok-lampu-gagal')) document.getElementById('stok-lampu-gagal').innerText = `${failCount} Pcs`;
    if(document.getElementById('fail-chip')) document.getElementById('fail-chip').innerText = failChip; 
    if(document.getElementById('fail-driver')) document.getElementById('fail-driver').innerText = failDriver; 
    if(document.getElementById('fail-solder')) document.getElementById('fail-solder').innerText = failSolder;
    
    attachModalListeners(); 
    renderCharts(summary); 
};

onSnapshot(query(collection(db, "bulbs"), orderBy("createdAt", "desc")), snap => {
    const rawDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
    globalQCData = rawDocs.map((d, index) => ({ ...d, computedArbCode: `ARB-${String(rawDocs.length - index).padStart(3, '0')}${d.randomSuffix||'XX'}` }));
    renderQCUI(); 
    if (document.getElementById('stok-item') && document.getElementById('stok-item').value === 'lampu' && document.getElementById('stok-type').value === 'out') renderBulbChecklist();
});

if(document.getElementById('search-input')) document.getElementById('search-input').addEventListener('input', renderQCUI);
if(document.getElementById('filter-status')) document.getElementById('filter-status').addEventListener('change', renderQCUI);

const calculateAutoPrice = () => {
    const item = document.getElementById('stok-item').value; 
    const variant = document.getElementById('stok-variant').value;
    let qty = 0; 
    if (item === 'lampu' && document.getElementById('stok-type').value === 'out') { 
        qty = document.querySelectorAll('.bulb-sale-cb:checked').length; 
    } else { 
        qty = parseInt(document.getElementById('stok-qty').value) || 0; 
    }
    const key = `${item}_${variant}`; 
    const unitPrice = masterPrices[key] || 0; 
    const totalInfo = document.getElementById('unit-price-info');
    if (unitPrice > 0) { 
        document.getElementById('stok-price').value = unitPrice * qty; 
        if(totalInfo) totalInfo.innerText = `@ Rp ${unitPrice}`; 
    } else { 
        if(totalInfo) totalInfo.innerText = "Harga Dasar Belum Diset"; 
    }
};

const renderBulbChecklist = () => {
    const variant = document.getElementById('stok-variant').value; 
    const type = document.getElementById('stok-type').value; 
    const item = document.getElementById('stok-item').value;
    const selectorDiv = document.getElementById('stok-bulb-selector'); 
    const qtyWrapper = document.getElementById('stok-qty-wrapper'); 
    const listDiv = document.getElementById('bulb-checkbox-list');
    
    if (type === 'out' && item === 'lampu' && variant) {
        qtyWrapper.style.display = 'none'; 
        document.getElementById('stok-qty').required = false; 
        selectorDiv.style.display = 'flex';
        const availableBulbs = globalQCData.filter(b => b.status === 'produksi' && b.watt === variant);
        if (availableBulbs.length === 0) {
            listDiv.innerHTML = '<p style="font-size:0.8rem; color:var(--status-dead); padding:10px;">Stok Siap Jual Kosong.</p>';
        } else { 
            listDiv.innerHTML = availableBulbs.map(b => `<label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer; background:var(--surface-card); padding:8px; border-radius:6px; border:1px solid var(--border-light);"><input type="checkbox" class="bulb-sale-cb" value="${b.id}" data-arb="${b.computedArbCode}"><span style="font-weight:bold; color:var(--accent-primary);">${b.computedArbCode}</span></label>`).join('');
            document.querySelectorAll('.bulb-sale-cb').forEach(cb => { 
                cb.addEventListener('change', () => { 
                    document.getElementById('selected-bulb-count').innerText = document.querySelectorAll('.bulb-sale-cb:checked').length; 
                    calculateAutoPrice(); 
                }); 
            });
        } 
        document.getElementById('selected-bulb-count').innerText = '0';
    } else { 
        selectorDiv.style.display = 'none'; 
        qtyWrapper.style.display = 'block'; 
        if (type !== 'out' || item !== 'lampu') document.getElementById('stok-qty').required = true; 
    }
};

const handleStokFormDynamic = () => {
    const type = document.getElementById('stok-type').value; 
    const item = document.getElementById('stok-item').value; 
    document.getElementById('stok-variant-wrapper').style.display = 'none'; 
    document.getElementById('stok-variant').required = false; 
    document.getElementById('financial-wrapper').style.display = 'none'; 
    document.getElementById('stok-contact').required = false; 
    document.getElementById('stok-price').required = false;
    document.getElementById('stok-variant').innerHTML = '<option value="">Pilih Varian...</option>';
    
    if (item === 'pcb' || item === 'cover' || item === 'lampu') { 
        masterVariants.watt.forEach(w => document.getElementById('stok-variant').innerHTML += `<option value="${w}">${w}</option>`); 
        document.getElementById('stok-variant-wrapper').style.display = 'block'; 
        document.getElementById('stok-variant').required = true; 
    } else if (item === 'ulir') { 
        masterVariants.ulir.forEach(u => document.getElementById('stok-variant').innerHTML += `<option value="${u}">${u}</option>`); 
        document.getElementById('stok-variant-wrapper').style.display = 'block'; 
        document.getElementById('stok-variant').required = true; 
    }
    
    let isFinancial = false; 
    document.getElementById('stok-contact').innerHTML = '<option value="">Pilih Kontak...</option>';
    
    if (type === 'out' && item === 'lampu') { 
        isFinancial = true; 
        if(masterKontak.klien) masterKontak.klien.forEach(k => document.getElementById('stok-contact').innerHTML += `<option value="${k}">${k}</option>`); 
    } else if (type === 'in' && item !== 'lampu') { 
        isFinancial = true; 
        if(masterKontak.supplier) masterKontak.supplier.forEach(s => document.getElementById('stok-contact').innerHTML += `<option value="${s}">${s}</option>`); 
    }
    
    if (isFinancial) { 
        document.getElementById('financial-wrapper').style.display = 'flex'; 
        document.getElementById('stok-contact').required = true; 
        document.getElementById('stok-price').required = true; 
    }
    
    window.initCustomDropdowns(); 
    window.refreshSelectUI('stok-variant'); 
    window.refreshSelectUI('stok-contact'); 
    renderBulbChecklist(); 
    calculateAutoPrice();
};

if(document.getElementById('stok-type')) document.getElementById('stok-type').addEventListener('change', handleStokFormDynamic);
if(document.getElementById('stok-item')) document.getElementById('stok-item').addEventListener('change', handleStokFormDynamic);
if(document.getElementById('stok-variant')) document.getElementById('stok-variant').addEventListener('change', () => { renderBulbChecklist(); calculateAutoPrice(); });
if(document.getElementById('stok-qty')) document.getElementById('stok-qty').addEventListener('input', calculateAutoPrice);

if (document.getElementById('stok-form')) {
    document.getElementById('stok-form').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const type = document.getElementById('stok-type').value; 
        const item = document.getElementById('stok-item').value; 
        const variant = document.getElementById('stok-variant').value || null; 
        const date = new Date().toISOString(); 
        const isSale = (type === 'out' && item === 'lampu'); 
        let qty = 0; 
        let bulbsToAutoUpdate = []; 
        let arbCodesStr = [];

        if (isSale) { 
            if(!variant) return window.showToast("Pilih varian!", true); 
            const checkedBoxes = document.querySelectorAll('.bulb-sale-cb:checked'); 
            qty = checkedBoxes.length; 
            if (qty === 0) return window.showToast("Pilih Kode ARB!", true); 
            checkedBoxes.forEach(cb => { bulbsToAutoUpdate.push(cb.value); arbCodesStr.push(cb.dataset.arb); });
        } else { 
            qty = parseInt(document.getElementById('stok-qty').value); 
        }

        const btn = e.target.querySelector('button[type="submit"]'); 
        const origBtnHtml = btn.innerHTML; 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        btn.disabled = true;

        try {
            await addDoc(collection(db, "stock_history"), { item, variant, type, qty, createdAt: new Date() });
            
            if (document.getElementById('financial-wrapper').style.display === 'flex') {
                const totalRp = parseInt(document.getElementById('stok-price').value); 
                const statusBayar = document.getElementById('stok-payment').value; 
                const contact = document.getElementById('stok-contact').value;
                let ledgerType = ''; 
                if (isSale) ledgerType = (statusBayar === 'lunas') ? 'income' : 'receivable'; 
                else ledgerType = (statusBayar === 'lunas') ? 'expense' : 'payable'; 
                const ket = isSale && qty <= 3 ? `Jual ${qty}pcs ${variant} (${qty} Serial)` : (isSale ? `Jual ${qty}pcs ${item} ${variant||''}` : `Beli ${qty}pcs ${item} ${variant||''}`);
                
                await addDoc(collection(db, "finance_ledger"), { type: ledgerType, amount: totalRp, paidAmount: 0, contact: contact, ref: ket, date: date.split('T')[0], createdAt: new Date() });
                
                if (isSale) {
                    window.logActivity(`[STOK - PENJUALAN] Menjual ${qty} Pcs Lampu Jadi (${variant}) ke ${contact}. Total Rp ${totalRp} (${statusBayar.toUpperCase()}). Serial: [${arbCodesStr.join(', ')}]`);
                } else {
                    window.logActivity(`[STOK - PEMBELIAN] Membeli ${qty} Pcs ${item.toUpperCase()} ${variant||''} dari ${contact}. Total Rp ${totalRp} (${statusBayar.toUpperCase()}).`);
                }
            } else { 
                window.logActivity(`[STOK - MANUAL] Melakukan input ${type === 'in' ? 'Barang Masuk' : 'Barang Keluar'} secara manual. Item: ${qty} Pcs ${item.toUpperCase()} ${variant||''}`); 
            }

            if (isSale && bulbsToAutoUpdate.length > 0) { 
                for (const docId of bulbsToAutoUpdate) await updateDoc(doc(db, "bulbs", docId), { status: 'active' }); 
            }
            e.target.reset(); 
            handleStokFormDynamic(); 
            window.showToast("Transaksi Berhasil!");
        } catch (error) { 
            window.showToast("Gagal menyimpan transaksi", true); 
        } finally { 
            btn.innerHTML = origBtnHtml; 
            btn.disabled = false; 
        }
    });
}

onSnapshot(query(collection(db, "stock_history")), snap => {
    const stockDocs = snap.docs.map(d => d.data()); 
    let inventory = { pcb: {}, cover: {}, ulir: {}, lem: 0 };
    stockDocs.forEach(data => { 
        const mult = data.type === 'in' ? 1 : -1; 
        if(data.item === 'lem') { 
            inventory.lem += (data.qty * mult); 
        } else if(data.item !== 'lampu') { 
            if(!inventory[data.item][data.variant]) inventory[data.item][data.variant] = 0; 
            inventory[data.item][data.variant] += (data.qty * mult); 
        } 
    });
    
    if (document.getElementById('stok-lem')) document.getElementById('stok-lem').innerText = `${inventory.lem} Pcs`; 
    renderQCUI(); 
    
    const rc = document.getElementById('rekap-stok-container'); 
    if(rc) { 
        rc.innerHTML = ''; 
        ['pcb', 'cover', 'ulir'].forEach(cat => { 
            Object.keys(inventory[cat]).forEach(v => { 
                rc.innerHTML += `<div style="background:var(--bg-main); padding:10px; border-radius:8px; border:1px solid var(--border-light); text-align:center;"><div style="font-size:0.8rem; color:var(--text-muted);">${cat.toUpperCase()}</div><div style="font-weight:bold; margin:5px 0;">${v}</div><div style="font-size:1.2rem; font-weight:bold;">${inventory[cat][v]} Pcs</div></div>`; 
            }); 
        }); 
    }
});

// Modals =====================
let docIdToDelete = null; let docToEdit = null; let arbCodeTemp = null; let oldStatusTemp = null; let oldWattTemp = null;
const closeModals = () => { 
    document.querySelectorAll('.modal-overlay').forEach(m => { 
        m.classList.remove('active'); 
        setTimeout(() => m.classList.add('hidden'), 300); 
    }); 
};
document.querySelectorAll('#btn-cancel-delete, #btn-cancel-edit').forEach(b => b.addEventListener('click', closeModals));

if (document.getElementById('btn-confirm-delete')) document.getElementById('btn-confirm-delete').addEventListener('click', async () => { 
    await deleteDoc(doc(db, "bulbs", docIdToDelete)); 
    window.logActivity(`[QC - HAPUS] Menghapus permanen data QC Lampu: ${arbCodeTemp}`); 
    closeModals(); 
    window.showToast("Data dihapus"); 
});

if (document.getElementById('btn-confirm-edit')) document.getElementById('btn-confirm-edit').addEventListener('click', async () => {
    const s = document.getElementById('edit-status-select').value; 
    const w = document.getElementById('edit-bulb-watt').value; 
    const up = { status: s }; 
    if (w) up.watt = w; 
    
    const isNewDead = s.startsWith('dead'); 
    const isOldDead = docToEdit.old.startsWith('dead'); 
    if (isNewDead && !isOldDead) { 
        up.failedDate = new Date().toISOString().split('T')[0]; 
    } else if (!isNewDead) { 
        up.failedDate = null; 
    }
    
    await updateDoc(doc(db, "bulbs", docToEdit.id), up); 
    window.logActivity(`[QC - EDIT] Mengubah data ${arbCodeTemp}. Status: ${oldStatusTemp} menjadi ${s}. Watt: ${oldWattTemp} menjadi ${w}`); 
    closeModals(); 
    window.showToast("QC diperbarui");
});

const attachModalListeners = () => {
    document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', e => { 
        docIdToDelete = e.currentTarget.dataset.id; 
        arbCodeTemp = e.currentTarget.dataset.code; 
        document.getElementById('custom-delete-modal').classList.remove('hidden'); 
        setTimeout(() => document.getElementById('custom-delete-modal').classList.add('active'), 10); 
    }));
    document.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', e => { 
        docToEdit = { id: e.currentTarget.dataset.id, old: e.currentTarget.dataset.status }; 
        arbCodeTemp = e.currentTarget.dataset.code; 
        oldStatusTemp = e.currentTarget.dataset.status; 
        oldWattTemp = e.currentTarget.dataset.watt; 
        const codeEl = document.getElementById('edit-arb-code'); 
        if(codeEl) codeEl.innerText = arbCodeTemp; 
        document.getElementById('edit-status-select').value = docToEdit.old; 
        document.getElementById('edit-bulb-watt').value = oldWattTemp || ''; 
        window.refreshSelectUI('edit-status-select'); 
        window.refreshSelectUI('edit-bulb-watt'); 
        document.getElementById('edit-modal').classList.remove('hidden'); 
        setTimeout(() => document.getElementById('edit-modal').classList.add('active'), 10); 
    }));
};

window.addEventListener('online', () => { 
    document.getElementById('db-status-el').innerHTML = '<i class="fa-solid fa-circle-check"></i> Online'; 
    document.getElementById('db-status-el').style.color = 'var(--status-active)'; 
});
window.addEventListener('offline', () => { 
    document.getElementById('db-status-el').innerHTML = '<i class="fa-solid fa-wifi" style="text-decoration: line-through;"></i> Offline'; 
    document.getElementById('db-status-el').style.color = 'var(--status-dead)'; 
    window.showToast("Offline", true); 
});

if (document.getElementById('btn-export-csv')) document.getElementById('btn-export-csv').addEventListener('click', () => {
    let csv = "Kode ARB,Batch,Watt,Tanggal,Status,Umur\n"; 
    const sMap = { 'produksi': 'Produksi', 'active': 'Aktif', 'dead_chip': 'Gagal: Chip', 'dead_driver': 'Gagal: Driver', 'dead_solder': 'Gagal: Solder' }; 
    globalQCData.forEach((d) => { 
        let age = 0; 
        if (d.status !== 'produksi') age = d.failedDate ? calculateDays(d.productionDate, d.failedDate) : calculateDays(d.productionDate); 
        csv += `${d.computedArbCode},${d.batch},${d.watt||'-'},${d.productionDate},${sMap[d.status]},${age}\n`; 
    });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); 
    a.download = `Laporan_QC_${new Date().toISOString().split('T')[0]}.csv`; 
    a.click(); 
    window.logActivity("[SISTEM] Mengunduh Laporan Data QC ke format CSV");
});
