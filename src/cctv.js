/*
  Version: 8.0.0
  Date: 2026-04-10
  Changelog:
  - MODULE: Separated CCTV logging. Added limit(50) for memory optimization.
*/
import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { currentUserEmail } from './auth.js';

let logLimit = 50;

export const logActivity = async (actionDesc) => {
    if(!currentUserEmail) return;
    try { await addDoc(collection(db, "system_logs"), { actor: currentUserEmail, action: actionDesc, timestamp: new Date().toISOString() }); } catch(e) {}
};

export const initCCTV = () => {
    const fetchLogs = () => {
        onSnapshot(query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(logLimit)), snap => {
            const list = document.getElementById('cctv-list-page'); if(!list) return; list.innerHTML = '';
            snap.docs.forEach(doc => {
                const d = doc.data(); const t = new Date(d.timestamp).toLocaleString('id-ID');
                list.innerHTML += `<div style="padding: 12px; border-bottom: 1px solid var(--border-light); font-size: 0.85rem;">
                    <div style="color: var(--text-muted); margin-bottom: 5px;">${t} | <span style="color: var(--accent-primary); font-weight: bold;">${d.actor}</span></div>
                    <div style="color: var(--text-main);">${d.action}</div></div>`;
            });
        });
    };
    fetchLogs();
    document.getElementById('btn-load-more-cctv').addEventListener('click', () => { logLimit += 50; fetchLogs(); });
};
