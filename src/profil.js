/*
  Version: 10.1.1 (Hotfix Profile Sync)
  Date: 2026-04-11
  Changelog:
  - BUGFIX: Refactored initProfil to listen to onAuthStateChanged natively.
  - LOGIC: Eliminated race condition causing blank profile on initial login.
*/
import { db, auth } from './firebase.js';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { showToast } from './ui.js';
import { logActivity } from './cctv.js';

let profileUnsubscribe = null;

export const initProfil = () => {
    const profilFormWrapper = document.getElementById('profil-form-wrapper');
    const namaDisplay = document.getElementById('profil-nama-display');
    const emailDisplay = document.getElementById('profil-email-display');
    const roleBadge = document.getElementById('profil-role-badge');
    const phoneDisplay = document.getElementById('profil-phone-display');

    // BIKIN PROFIL MANDIRI NGIKUTIN STATE AUTH
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const email = user.email;
            if (profileUnsubscribe) profileUnsubscribe(); // Clean up old listener

            // Sabar nunggu data Firestore khusus user ini
            profileUnsubscribe = onSnapshot(doc(db, "user_roles", email), (docSnap) => {
                emailDisplay.innerText = email;

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    // Render Role
                    const role = data.role || 'operator';
                    roleBadge.innerText = role === 'admin' ? 'Admin / Pemilik' : 'Operator';
                    roleBadge.className = role === 'admin' ? 'status-tag status-active' : 'status-tag status-produksi';

                    // Render Nama & Phone
                    if (data.nama) {
                        namaDisplay.innerText = data.nama;
                        if (data.phone) {
                            phoneDisplay.innerHTML = `<i class="fa-solid fa-phone"></i> ${data.phone}`;
                            phoneDisplay.style.color = 'var(--text-main)';
                        } else {
                            phoneDisplay.innerHTML = `<i class="fa-solid fa-phone-slash"></i> Tidak ada No HP`;
                            phoneDisplay.style.color = 'var(--text-muted)';
                        }
                        profilFormWrapper.style.display = 'none';
                    } else {
                        namaDisplay.innerText = "Belum Ada Nama";
                        profilFormWrapper.style.display = 'flex';
                    }
                } else {
                    // Fallback kalau dokumen belum ada sama sekali
                    roleBadge.innerText = 'Operator';
                    roleBadge.className = 'status-tag status-produksi';
                    namaDisplay.innerText = "Belum Ada Nama";
                    profilFormWrapper.style.display = 'flex';
                }
            });
        } else {
            // Kalau logout, matikan listener biar memori enteng
            if (profileUnsubscribe) { 
                profileUnsubscribe(); 
                profileUnsubscribe = null; 
            }
            namaDisplay.innerText = "-";
            emailDisplay.innerText = "-";
        }
    });

    const form = document.getElementById('profil-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nama = document.getElementById('profil-input-nama').value.trim();
            const phone = document.getElementById('profil-input-phone').value.trim();
            const btn = e.target.querySelector('button');
            
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
            btn.disabled = true;

            try {
                const user = auth.currentUser;
                if(!user) return;
                await setDoc(doc(db, "user_roles", user.email), {
                    nama: nama,
                    phone: phone || null
                }, { merge: true });

                logActivity(`[SISTEM] Akun ${user.email} melengkapi profil: ${nama}`);
                showToast("Profil berhasil dipermanenkan!");
            } catch (err) {
                showToast("Gagal menyimpan profil", true);
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-user-check"></i> Permanenkan Profil';
                btn.disabled = false;
            }
        });
    }

    const btnProfilLogout = document.getElementById('btn-profil-logout');
    if (btnProfilLogout) {
        btnProfilLogout.addEventListener('click', async () => {
            logActivity("[AUTH] Logout dari tab Profil.");
            try { await signOut(auth); } catch (err) { showToast("Gagal Logout", true); }
        });
    }
};
