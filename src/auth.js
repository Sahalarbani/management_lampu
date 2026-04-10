/*
  Version: 10.1.0
  Date: 2026-04-11
  Changelog:
  - LOGIC: Cleaned up references to deleted top-right user info DOM elements.
*/
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { showToast } from './ui.js';
import { logActivity } from './cctv.js';

export let currentUserEmail = null;
export let currentUserRole = 'operator';

export const initAuth = () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserEmail = user.email;
            
            try {
                const roleSnap = await getDoc(doc(db, "user_roles", user.email));
                if(roleSnap.exists()) currentUserRole = roleSnap.data().role;
            } catch(e) { currentUserRole = 'operator'; } 

            document.getElementById('login-screen').classList.replace('active', 'hidden');
            document.getElementById('main-app-container').style.display = 'block';
            
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = (currentUserRole === 'admin') ? '' : 'none';
            });
        } else {
            currentUserEmail = null; currentUserRole = 'operator';
            document.getElementById('main-app-container').style.display = 'none';
            document.getElementById('login-screen').classList.replace('hidden', 'active');
        }

        const splash = document.getElementById('splash-screen');
        if (splash && splash.style.display !== 'none') {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 400); 
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const em = document.getElementById('login-email').value; 
        const pw = document.getElementById('login-password').value;
        const btn = e.target.querySelector('button[type="submit"]'); 
        const origText = btn.innerHTML;
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuka...';
        
        try { 
            await signInWithEmailAndPassword(auth, em, pw); 
            showToast("Sesi Keamanan Diverifikasi!"); 
            logActivity("[AUTH] Login ke dalam sistem."); 
        } 
        catch(err) { showToast("Akses Ditolak. Periksa kembali Kredensial.", true); } 
        finally { btn.innerHTML = origText; }
    });
};
