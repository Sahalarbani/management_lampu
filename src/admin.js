/*
  Version: 9.2.0
  Date: 2026-04-11
  Changelog:
  - FEATURE: Built Secondary Firebase App to register new users without logging out the Admin.
  - FEATURE: Employee list rendering and inline Edit Modal (Name & Role).
*/
import { db, firebaseConfig } from './firebase.js'; // Kita tarik firebaseConfig
import { doc, onSnapshot, setDoc, arrayUnion, collection, updateDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { showToast, refreshSelectUI, initCustomDropdowns } from './ui.js';
import { logActivity } from './cctv.js';

export const masterVariants = { watt: [], ulir: [] }; 
export const masterPrices = {}; 
export const masterKontak = { klien: [], supplier: [] };

// Inisialisasi Aplikasi Firebase Ke-2 Khusus Buat Bikin Akun (Biar Admin Nggak Ke-Logout)
const secondaryApp = initializeApp(firebaseConfig, "SecondaryAdminApp");
const secondaryAuth = getAuth(secondaryApp);

let editingUserEmail = null;

export const initAdmin = () => {
    // =====================================
    // MANAJEMEN KARYAWAN
    // =====================================
    
    // Trik Logo Mata buat Password Register Karyawan
    const toggleRegPass = document.getElementById('toggle-reg-pass');
    const regPassInput = document.getElementById('reg-password');
    if(toggleRegPass && regPassInput) {
        toggleRegPass.addEventListener('click', () => {
            const type = regPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
            regPassInput.setAttribute('type', type);
            toggleRegPass.classList.toggle('fa-eye');
            toggleRegPass.classList.toggle('fa-eye-slash');
        });
    }

    // Submit Bikin Akun Baru
    document.getElementById('karyawan-reg-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value.trim();
        const pass = document.getElementById('reg-password').value;
        const nama = document.getElementById('reg-nama').value.trim();
        const role = document.getElementById('reg-role').value;
        
        const btn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuat Akun...';
        btn.disabled = true;

        try {
            // 1. Bikin User di Auth Firebase pakai Secondary App
            await createUserWithEmailAndPassword(secondaryAuth, email, pass);
            await signOut(secondaryAuth); // Langsung logout si secondary biar aman
            
            // 2. Simpan Data Role & Nama ke Firestore
            await setDoc(doc(db, "user_roles", email), { role: role, nama: nama, phone: null }, { merge: true });
            
            logActivity(`[ADMIN] Mendaftarkan karyawan baru: ${nama} (${email}) sebagai ${role.toUpperCase()}`);
            showToast(`Akun ${nama} berhasil dibuat!`);
            e.target.reset();
            refreshSelectUI('reg-role');
        } catch (error) {
            console.error(error);
            showToast("Gagal membuat akun! Pastikan format email benar dan password min. 6 karakter.", true);
        } finally {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    });

    // Render List Karyawan secara Real-Time
    onSnapshot(collection(db, "user_roles"), (snap) => {
        const listContainer = document.getElementById('karyawan-list-container');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        snap.docs.forEach(docSnap => {
            const email = docSnap.id;
            const data = docSnap.data();
            const badgeColor = data.role === 'admin' ? 'var(--status-active)' : 'var(--status-produksi)';
            
            listContainer.innerHTML += `
                <div style="background: var(--surface-elevated); border: 1px solid var(--border-light); padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: bold; color: var(--text-main);">${data.nama || 'Belum Set Nama'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">${email}</div>
                        <span class="status-tag" style="background: ${badgeColor}; padding: 2px 8px; font-size: 0.7rem;">${data.role.toUpperCase()}</span>
                    </div>
                    <button class="btn-outline btn-edit-karyawan" data-email="${email}" data-nama="${data.nama || ''}" data-role="${data.role}" style="padding: 8px; width: auto; height: auto;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </div>
            `;
        });

        // Event Listener Tombol Edit
        document.querySelectorAll('.btn-edit-karyawan').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                editingUserEmail = target.dataset.email;
                document.getElementById('edit-karyawan-email').innerText = editingUserEmail;
                document.getElementById('edit-karyawan-nama').value = target.dataset.nama;
                document.getElementById('edit-karyawan-role').value = target.dataset.role;
                
                initCustomDropdowns();
                refreshSelectUI('edit-karyawan-role');

                document.getElementById('edit-karyawan-modal').classList.remove('hidden');
                setTimeout(() => document.getElementById('edit-karyawan-modal').classList.add('active'), 10);
            });
        });
    });

    // Simpan Editan Karyawan
    document.getElementById('edit-karyawan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const namaBaru = document.getElementById('edit-karyawan-nama').value.trim();
        const roleBaru = document.getElementById('edit-karyawan-role').value;

        try {
            await updateDoc(doc(db, "user_roles", editingUserEmail), { nama: namaBaru, role: roleBaru });
            logActivity(`[ADMIN] Mengedit profil ${editingUserEmail} -> Nama: ${namaBaru}, Role: ${roleBaru}`);
            showToast("Data karyawan diperbarui!");
            document.getElementById('btn-cancel-edit-karyawan').click();
        } catch (err) { showToast("Gagal update data", true); }
    });

    document.getElementById('btn-cancel-edit-karyawan').addEventListener('click', () => {
        document.getElementById('edit-karyawan-modal').classList.remove('active');
        setTimeout(() => document.getElementById('edit-karyawan-modal').classList.add('hidden'), 300);
    });

    // =====================================
    // MASTER DATA (Harga, Varian, Kontak)
    // =====================================
    onSnapshot(doc(db, "settings", "master_variants"), (docSnap) => {
        if (docSnap.exists()) { Object.assign(masterVariants, docSnap.data()); } 
        else { setDoc(doc(db, "settings", "master_variants"), { watt: ['5W'], ulir: ['E27'] }, { merge: true }); }
        
        const updateVS = (id) => { const sel = document.getElementById(id); if(!sel) return; const cur = sel.value; sel.innerHTML = '<option value="">Pilih Watt...</option>'; if(masterVariants.watt) masterVariants.watt.forEach(w => sel.innerHTML += `<option value="${w}">${w}</option>`); sel.value = cur; refreshSelectUI(id); };
        updateVS('bulb-watt'); updateVS('edit-bulb-watt');
        
        const c = document.getElementById('variant-tags-container'); if(c) { c.innerHTML = ''; if(masterVariants.watt) masterVariants.watt.forEach(w => c.innerHTML += `<span class="status-tag" style="background:var(--accent-primary);">${w}</span>`); }
        window.dispatchEvent(new Event('masterDataLoaded'));
    });

    document.getElementById('variant-form').addEventListener('submit', async (e) => { e.preventDefault(); const v = document.getElementById('new-variant-val').value.trim().toUpperCase(); const t = document.getElementById('new-variant-type').value; if(v) { try { await setDoc(doc(db, "settings", "master_variants"), { [t]: arrayUnion(v) }, { merge: true }); logActivity(`[MASTER] Tambah Varian: ${v}`); document.getElementById('new-variant-val').value = ''; showToast("Varian ditambah!"); } catch(e) {} } });

    onSnapshot(doc(db, "settings", "master_prices"), (docSnap) => { if (docSnap.exists()) Object.assign(masterPrices, docSnap.data()); const pc = document.getElementById('price-list-container'); if(pc) { pc.innerHTML = ''; Object.keys(masterPrices).forEach(key => { pc.innerHTML += `<div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid var(--border-light);"><span>${key.toUpperCase()}</span><span style="color:var(--status-active);">Rp ${masterPrices[key]}</span></div>`; }); } });

    document.getElementById('price-item').addEventListener('change', (e) => { const pItem = e.target.value; const sel = document.getElementById('price-variant'); sel.innerHTML = '<option value="">Varian...</option>'; if(pItem === 'pcb' || pItem === 'lampu' || pItem === 'cover') { if(masterVariants.watt) masterVariants.watt.forEach(w => sel.innerHTML += `<option value="${w}">${w}</option>`); } else if(pItem === 'ulir') { if(masterVariants.ulir) masterVariants.ulir.forEach(u => sel.innerHTML += `<option value="${u}">${u}</option>`); } refreshSelectUI('price-variant'); });

    document.getElementById('price-form').addEventListener('submit', async (e) => { e.preventDefault(); const itm = document.getElementById('price-item').value; const vnt = document.getElementById('price-variant').value; const val = parseInt(document.getElementById('price-val').value); if(itm && vnt) { try { await setDoc(doc(db, "settings", "master_prices"), { [`${itm}_${vnt}`]: val }, { merge: true }); logActivity(`[MASTER] Harga ${itm} ${vnt} -> Rp ${val}`); showToast("Harga diupdate!"); } catch(e){} } });

    onSnapshot(doc(db, "settings", "master_kontak"), (docSnap) => { if (docSnap.exists()) Object.assign(masterKontak, docSnap.data()); });
    document.getElementById('contact-form').addEventListener('submit', async (e) => { e.preventDefault(); const nama = document.getElementById('new-contact-name').value.trim(); const tipe = document.getElementById('new-contact-type').value; if(nama) { try { await setDoc(doc(db, "settings", "master_kontak"), { [tipe]: arrayUnion(nama) }, { merge: true }); document.getElementById('new-contact-name').value = ''; showToast("Kontak ditambah!"); } catch(e){} } });
};
