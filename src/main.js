/*
  Version: 10.1.1
  Date: 2026-04-11
  Changelog:
  - LOGIC: Removed setTimeout wrapper for initProfil as it now manages its own auth state natively.
*/
import { initAuth } from './auth.js';
import { handleRouting, initCustomDropdowns } from './ui.js';
import { initAdmin } from './admin.js';
import { initCCTV } from './cctv.js';
import { initQC } from './qc.js';
import { initStok } from './stok.js';
import { initKeuangan } from './keuangan.js';
import { initProfil } from './profil.js'; 

window.addEventListener('hashchange', handleRouting); 

window.addEventListener('DOMContentLoaded', () => { 
    // Logo Mata (Eye Icon) buat Halaman Login
    const toggleLoginPass = document.getElementById('toggle-login-pass');
    const loginPassInput = document.getElementById('login-password');
    if(toggleLoginPass && loginPassInput) {
        toggleLoginPass.addEventListener('click', () => {
            const type = loginPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPassInput.setAttribute('type', type);
            toggleLoginPass.classList.toggle('fa-eye');
            toggleLoginPass.classList.toggle('fa-eye-slash');
        });
    }

    handleRouting(); 
    initAuth();
    initAdmin();
    initCCTV();
    initQC(); 
    initStok();
    initKeuangan();
    
    // Langsung tembak, nggak butuh delay lagi
    initProfil(); 

    setTimeout(initCustomDropdowns, 500); 
});
