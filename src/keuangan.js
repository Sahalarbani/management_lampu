/*
  Version: 6.1.0-FINANCE (Detailed CCTV Log)
  Date: 2026-04-09
  Changelog:
  - ENHANCED: Injected detailed logging string directly mapping to contact and payment amount.
*/

import { db } from './firebase.js';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from "firebase/firestore";

const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

let globalLedger = []; let activePaymentDocId = null; let activePaymentType = null; let activePaymentContact = null;

onSnapshot(query(collection(db, "finance_ledger"), orderBy("createdAt", "desc")), snap => {
    globalLedger = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let totalIncome = 0; let totalExpense = 0; let piutangBerjalan = 0; let hutangBerjalan = 0;
    const ledgerContainer = document.getElementById('ledger-container'); const piutangContainer = document.getElementById('active-piutang-container'); const hutangContainer = document.getElementById('active-hutang-container');
    
    if(ledgerContainer) ledgerContainer.innerHTML = ''; if(piutangContainer) piutangContainer.innerHTML = ''; if(hutangContainer) hutangContainer.innerHTML = '';

    globalLedger.forEach(trx => {
        if (trx.type === 'income') { totalIncome += trx.amount; } 
        else if (trx.type === 'expense') { totalExpense += trx.amount; } 
        else if (trx.type === 'receivable') {
            totalIncome += (trx.paidAmount || 0); const sisaTagihan = trx.amount - (trx.paidAmount || 0); piutangBerjalan += sisaTagihan;
            if(sisaTagihan > 0 && piutangContainer) {
                piutangContainer.innerHTML += `<div style="background:var(--surface-card); border-left:4px solid #3b82f6; padding:10px; margin-bottom:10px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="font-size:0.8rem; color:var(--text-muted);">${trx.date} | ${trx.ref}</div><div style="font-weight:bold; font-size:1.1rem; color:var(--text-main);">${trx.contact}</div><div style="display:flex; justify-content:space-between; margin-top:5px; align-items:center;"><span style="color:#ef4444; font-weight:bold;">Sisa: ${rp(sisaTagihan)}</span><button class="btn-outline btn-pay" data-id="${trx.id}" data-type="piutang" data-sisa="${sisaTagihan}" data-name="${trx.contact}" style="padding:4px 10px; font-size:0.8rem;">Terima Dana</button></div></div>`;
            }
        } else if (trx.type === 'payable') {
            totalExpense += (trx.paidAmount || 0); const sisaHutang = trx.amount - (trx.paidAmount || 0); hutangBerjalan += sisaHutang;
            if(sisaHutang > 0 && hutangContainer) {
                hutangContainer.innerHTML += `<div style="background:var(--surface-card); border-left:4px solid var(--status-dead); padding:10px; margin-bottom:10px; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="font-size:0.8rem; color:var(--text-muted);">${trx.date} | ${trx.ref}</div><div style="font-weight:bold; font-size:1.1rem; color:var(--text-main);">${trx.contact}</div><div style="display:flex; justify-content:space-between; margin-top:5px; align-items:center;"><span style="color:#ef4444; font-weight:bold;">Sisa: ${rp(sisaHutang)}</span><button class="btn-outline btn-pay" data-id="${trx.id}" data-type="hutang" data-sisa="${sisaHutang}" data-name="${trx.contact}" style="padding:4px 10px; font-size:0.8rem;">Bayar Cicilan</button></div></div>`;
            }
        }
        if (ledgerContainer) {
            let icon = '', color = '', sign = '';
            if(trx.type === 'income' || trx.type === 'receivable' || trx.type === 'payment_in') { icon = 'fa-arrow-down'; color = 'var(--status-active)'; sign = '+'; } else { icon = 'fa-arrow-up'; color = 'var(--status-dead)'; sign = '-'; }
            const statusTxt = (trx.type === 'receivable' || trx.type === 'payable') ? `<span class="status-tag" style="background:#f59e0b; font-size:0.7rem; padding:2px 6px;">TEMPO</span>` : '';
            ledgerContainer.innerHTML += `<div class="bulb-item" style="border-left: 4px solid ${color};"><div class="bulb-item-info"><strong><i class="fa-solid ${icon}" style="color:${color};"></i> ${trx.contact} ${statusTxt}</strong><br><small>${trx.date} | ${trx.ref}</small></div><div style="font-weight:bold; color:${color}; font-size:1.1rem;">${sign} ${rp(trx.amount)}</div></div>`;
        }
    });

    if(document.getElementById('keuangan-kas')) document.getElementById('keuangan-kas').innerText = rp(totalIncome - totalExpense);
    if(document.getElementById('keuangan-piutang')) document.getElementById('keuangan-piutang').innerText = rp(piutangBerjalan);
    if(document.getElementById('keuangan-hutang')) document.getElementById('keuangan-hutang').innerText = rp(hutangBerjalan);

    document.querySelectorAll('.btn-pay').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activePaymentDocId = e.target.dataset.id; activePaymentType = e.target.dataset.type;
            activePaymentContact = e.target.dataset.name; const sisa = parseInt(e.target.dataset.sisa);
            document.getElementById('payment-desc').innerHTML = `Pembayaran untuk <strong>${activePaymentContact}</strong><br>Sisa Tagihan: <span style="color:#ef4444; font-weight:bold;">${rp(sisa)}</span>`;
            document.getElementById('payment-amount').max = sisa; document.getElementById('payment-amount').value = sisa; 
            document.getElementById('payment-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('payment-modal').classList.add('active'), 10);
        });
    });
});

document.getElementById('btn-cancel-payment').addEventListener('click', () => { document.getElementById('payment-modal').classList.remove('active'); setTimeout(() => document.getElementById('payment-modal').classList.add('hidden'), 300); });

document.getElementById('btn-confirm-payment').addEventListener('click', async () => {
    const bayarRp = parseInt(document.getElementById('payment-amount').value);
    if(!bayarRp || bayarRp <= 0) return window.showToast("Nominal tidak valid", true);
    
    const trx = globalLedger.find(t => t.id === activePaymentDocId);
    const newPaidAmount = (trx.paidAmount || 0) + bayarRp;
    
    try {
        await updateDoc(doc(db, "finance_ledger", activePaymentDocId), { paidAmount: newPaidAmount });
        const logType = (activePaymentType === 'piutang') ? 'payment_in' : 'payment_out';
        await addDoc(collection(db, "finance_ledger"), { type: logType, amount: bayarRp, paidAmount: 0, contact: trx.contact, ref: `[Cicilan] ${trx.ref}`, date: new Date().toISOString().split('T')[0], createdAt: new Date() });
        
        // Detailed Logging untuk Keuangan
        if(window.logActivity) {
            const ket = logType === 'payment_in' ? `Menerima Pembayaran Piutang dari ${activePaymentContact} sebesar Rp ${bayarRp}` : `Melunasi Hutang ke ${activePaymentContact} sebesar Rp ${bayarRp}`;
            window.logActivity(`[KEUANGAN] ${ket}`);
        }
        
        window.showToast("Pembayaran dicatat!"); document.getElementById('btn-cancel-payment').click();
    } catch (error) { window.showToast("Gagal", true); }
});
