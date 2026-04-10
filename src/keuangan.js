/*
  Version: 8.7.0 (Analytics P&L Edition)
  Date: 2026-04-10
  Changelog:
  - FEATURE: Integrated Chart.js to render daily Profit & Loss mixed chart (Bar + Line).
  - LOGIC: Aggregated daily income and expenses for dynamic analytical rendering.
*/

import { db } from './firebase.js';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc } from "firebase/firestore";
import { showToast } from './ui.js';
import { logActivity } from './cctv.js';
import Chart from 'chart.js/auto'; // Panggil mesin chart

let financeChartInstance = null;

export const initKeuangan = () => {
    const rp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

    let globalLedger = []; 
    let activePaymentDocId = null; 
    let activePaymentType = null; 
    let activePaymentContact = null;

    onSnapshot(query(collection(db, "finance_ledger"), orderBy("createdAt", "desc")), snap => {
        globalLedger = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let totalIncome = 0; let totalExpense = 0; let piutangBerjalan = 0; let hutangBerjalan = 0;
        let dailyData = {}; // Objek untuk nampung data grafik per hari

        const ledgerContainer = document.getElementById('ledger-container'); 
        const piutangContainer = document.getElementById('active-piutang-container'); 
        const hutangContainer = document.getElementById('active-hutang-container');
        
        if(ledgerContainer) ledgerContainer.innerHTML = ''; 
        if(piutangContainer) piutangContainer.innerHTML = ''; 
        if(hutangContainer) hutangContainer.innerHTML = '';

        globalLedger.forEach(trx => {
            const dateStr = trx.date; 
            if (!dailyData[dateStr]) dailyData[dateStr] = { income: 0, expense: 0 };

            if (trx.type === 'income') { 
                totalIncome += trx.amount; 
                dailyData[dateStr].income += trx.amount;
            } 
            else if (trx.type === 'payment_in') {
                dailyData[dateStr].income += trx.amount;
            }
            else if (trx.type === 'expense') { 
                totalExpense += trx.amount; 
                dailyData[dateStr].expense += trx.amount;
            } 
            else if (trx.type === 'payment_out') {
                dailyData[dateStr].expense += trx.amount;
            }
            else if (trx.type === 'receivable') {
                totalIncome += (trx.paidAmount || 0); 
                dailyData[dateStr].income += (trx.paidAmount || 0);
                const sisaTagihan = trx.amount - (trx.paidAmount || 0); 
                piutangBerjalan += sisaTagihan;
                if(sisaTagihan > 0 && piutangContainer) {
                    piutangContainer.innerHTML += `<div style="background:var(--surface-elevated); padding:15px; margin-bottom:10px; border-radius:12px; border: 1px solid var(--border-light);"><div style="font-size:0.8rem; color:var(--text-muted); margin-bottom: 5px;">${trx.date} | ${trx.ref}</div><div style="font-weight:bold; font-size:1.1rem; color:var(--text-main);">${trx.contact}</div><div style="display:flex; justify-content:space-between; margin-top:10px; align-items:center;"><span style="color:var(--status-active); font-weight:bold;">Sisa: ${rp(sisaTagihan)}</span><button class="btn-outline btn-pay" data-id="${trx.id}" data-type="piutang" data-sisa="${sisaTagihan}" data-name="${trx.contact}" style="padding:6px 12px; font-size:0.85rem; height: auto;">Terima Dana</button></div></div>`;
                }
            } else if (trx.type === 'payable') {
                totalExpense += (trx.paidAmount || 0); 
                dailyData[dateStr].expense += (trx.paidAmount || 0);
                const sisaHutang = trx.amount - (trx.paidAmount || 0); 
                hutangBerjalan += sisaHutang;
                if(sisaHutang > 0 && hutangContainer) {
                    hutangContainer.innerHTML += `<div style="background:var(--surface-elevated); padding:15px; margin-bottom:10px; border-radius:12px; border: 1px solid var(--border-light);"><div style="font-size:0.8rem; color:var(--text-muted); margin-bottom: 5px;">${trx.date} | ${trx.ref}</div><div style="font-weight:bold; font-size:1.1rem; color:var(--text-main);">${trx.contact}</div><div style="display:flex; justify-content:space-between; margin-top:10px; align-items:center;"><span style="color:var(--status-dead); font-weight:bold;">Sisa: ${rp(sisaHutang)}</span><button class="btn-outline btn-pay" data-id="${trx.id}" data-type="hutang" data-sisa="${sisaHutang}" data-name="${trx.contact}" style="padding:6px 12px; font-size:0.85rem; height: auto;">Bayar Cicilan</button></div></div>`;
                }
            }

            // Render Ledger DOM
            if (ledgerContainer) {
                let icon = '', color = '', sign = '';
                if(trx.type === 'income' || trx.type === 'receivable' || trx.type === 'payment_in') { icon = 'fa-arrow-down'; color = 'var(--status-active)'; sign = '+'; } 
                else { icon = 'fa-arrow-up'; color = 'var(--status-dead)'; sign = '-'; }
                const statusTxt = (trx.type === 'receivable' || trx.type === 'payable') ? `<span class="status-tag" style="background:var(--status-warning); font-size:0.7rem; padding:2px 6px; margin-left:5px;">TEMPO</span>` : '';
                ledgerContainer.innerHTML += `<div class="bulb-item"><div class="bulb-item-info"><strong><i class="fa-solid ${icon}" style="color:${color}; margin-right:5px;"></i> ${trx.contact} ${statusTxt}</strong><br><small style="color:var(--text-muted);">${trx.date} | ${trx.ref}</small></div><div style="font-weight:bold; color:${color}; font-size:1.1rem;">${sign} ${rp(trx.amount)}</div></div>`;
            }
        });

        if(document.getElementById('keuangan-kas')) document.getElementById('keuangan-kas').innerText = rp(totalIncome - totalExpense);
        if(document.getElementById('keuangan-piutang')) document.getElementById('keuangan-piutang').innerText = rp(piutangBerjalan);
        if(document.getElementById('keuangan-hutang')) document.getElementById('keuangan-hutang').innerText = rp(hutangBerjalan);

        // Pasang Event Listener Bayar Cicilan
        document.querySelectorAll('.btn-pay').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activePaymentDocId = e.target.dataset.id; activePaymentType = e.target.dataset.type;
                activePaymentContact = e.target.dataset.name; const sisa = parseInt(e.target.dataset.sisa);
                document.getElementById('payment-desc').innerHTML = `Pembayaran untuk <strong>${activePaymentContact}</strong><br>Sisa Tagihan: <span style="color:var(--status-dead); font-weight:bold;">${rp(sisa)}</span>`;
                document.getElementById('payment-amount').max = sisa; document.getElementById('payment-amount').value = sisa; 
                document.getElementById('payment-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('payment-modal').classList.add('active'), 10);
            });
        });

        // ==========================================
        // EKSEKUSI RENDER CHART PROFIT & LOSS
        // ==========================================
        const ctx = document.getElementById('finance-chart');
        if (ctx) {
            // Urutkan tanggal dari yang terlama ke terbaru
            const sortedDates = Object.keys(dailyData).sort();
            const incomeArr = sortedDates.map(d => dailyData[d].income);
            const expenseArr = sortedDates.map(d => dailyData[d].expense);
            const profitArr = sortedDates.map(d => dailyData[d].income - dailyData[d].expense);

            if (financeChartInstance) financeChartInstance.destroy();

            financeChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sortedDates.length > 0 ? sortedDates : ['Data Kosong'],
                    datasets: [
                        {
                            type: 'line',
                            label: 'Profit Bersih',
                            data: profitArr.length > 0 ? profitArr : [0],
                            borderColor: '#e5e7eb', // Silver Text Color
                            backgroundColor: '#e5e7eb',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: false,
                            yAxisID: 'y'
                        },
                        {
                            type: 'bar',
                            label: 'Pemasukan',
                            data: incomeArr.length > 0 ? incomeArr : [0],
                            backgroundColor: '#059669', // Sage Green
                            borderRadius: 4
                        },
                        {
                            type: 'bar',
                            label: 'Pengeluaran',
                            data: expenseArr.length > 0 ? expenseArr : [0],
                            backgroundColor: '#9b2c2c', // Muted Terracotta
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { 
                        legend: { labels: { color: '#e5e7eb', font: { family: "'Segoe UI', Tahoma, sans-serif" } } },
                        tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': ' + rp(context.raw); } } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
                        y: { grid: { color: '#2c3135' }, ticks: { color: '#9ca3af', callback: function(value) { return 'Rp ' + (value/1000) + 'k'; } } }
                    }
                }
            });
        }
    });

    document.getElementById('btn-cancel-payment').addEventListener('click', () => { document.getElementById('payment-modal').classList.remove('active'); setTimeout(() => document.getElementById('payment-modal').classList.add('hidden'), 300); });

    document.getElementById('btn-confirm-payment').addEventListener('click', async () => {
        const bayarRp = parseInt(document.getElementById('payment-amount').value);
        if(!bayarRp || bayarRp <= 0) return showToast("Nominal tidak valid", true);
        
        const trx = globalLedger.find(t => t.id === activePaymentDocId);
        const newPaidAmount = (trx.paidAmount || 0) + bayarRp;
        
        try {
            await updateDoc(doc(db, "finance_ledger", activePaymentDocId), { paidAmount: newPaidAmount });
            const logType = (activePaymentType === 'piutang') ? 'payment_in' : 'payment_out';
            await addDoc(collection(db, "finance_ledger"), { type: logType, amount: bayarRp, paidAmount: 0, contact: trx.contact, ref: `[Cicilan] ${trx.ref}`, date: new Date().toISOString().split('T')[0], createdAt: new Date() });
            
            const ket = logType === 'payment_in' ? `Menerima Pembayaran Piutang dari ${activePaymentContact} sebesar Rp ${bayarRp}` : `Melunasi Hutang ke ${activePaymentContact} sebesar Rp ${bayarRp}`;
            logActivity(`[KEUANGAN] ${ket}`);
            
            showToast("Pembayaran dicatat!"); document.getElementById('btn-cancel-payment').click();
        } catch (error) { showToast("Gagal", true); }
    });
};
