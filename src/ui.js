/*
  Version: 9.3.0
  Date: 2026-04-11
  Changelog:
  - MODULE: Updated routing to highlight explicitly added Profil nav tab.
*/
export const showToast = (msg, isErr=false) => {
    let c = document.querySelector('.toast-container'); 
    if(!c){ c = document.createElement('div'); c.className='toast-container'; c.style.zIndex = '999999'; document.body.appendChild(c); }
    const t = document.createElement('div'); t.className = `toast ${isErr?'error':''}`; t.innerHTML = `<i class="fa-solid ${isErr?'fa-circle-xmark':'fa-circle-check'}"></i> ${msg}`;
    c.appendChild(t); setTimeout(()=>t.classList.add('show'), 100); setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 3000);
};

export const initCustomDropdowns = () => {
    document.querySelectorAll('select').forEach(sel => {
        if (sel.dataset.customized || sel.style.display === 'none') return;
        sel.dataset.customized = "true"; sel.style.display = "none";
        const w = document.createElement("div"); w.className = "custom-dropdown"; if(sel.style.flex) w.style.flex = sel.style.flex;
        const sd = document.createElement("div"); sd.className = "custom-dropdown-selected"; 
        const od = document.createElement("div"); od.className = "custom-dropdown-options";
        w.appendChild(sd); w.appendChild(od); sel.parentNode.insertBefore(w, sel.nextSibling);
        const ro = () => {
            od.innerHTML = ""; let st = "Pilih...";
            Array.from(sel.options).forEach((opt, i) => { 
                if(sel.selectedIndex === i) st = opt.text;
                const d = document.createElement("div"); d.className = "custom-dropdown-option" + (sel.selectedIndex === i ? " selected" : ""); d.innerText = opt.text;
                d.addEventListener("click", () => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); od.classList.remove("show"); ro(); }); od.appendChild(d);
            }); 
            sd.innerHTML = `<span>${st}</span><i class="fa-solid fa-chevron-down"></i>`;
        };
        sd.addEventListener("click", (e) => { e.stopPropagation(); document.querySelectorAll('.custom-dropdown-options').forEach(el=>{if(el!==od) el.classList.remove('show');}); od.classList.toggle("show"); }); sel.refreshCustomUI = ro; ro();
    });
};

document.addEventListener("click", () => document.querySelectorAll('.custom-dropdown-options').forEach(el => el.classList.remove('show'))); 
export const refreshSelectUI = (id) => { const el = document.getElementById(id); if(el && el.refreshCustomUI) el.refreshCustomUI(); };

export const handleRouting = () => {
    const hash = window.location.hash || '#/qc';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); 
    document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
    
    if (hash === '#/stok') { document.getElementById('nav-stok').classList.add('active'); document.getElementById('page-stok').classList.remove('hidden'); }
    else if (hash === '#/keuangan') { document.getElementById('nav-keuangan').classList.add('active'); document.getElementById('page-keuangan').classList.remove('hidden'); }
    else if (hash === '#/admin') { document.getElementById('nav-admin').classList.add('active'); document.getElementById('page-admin').classList.remove('hidden'); }
    else if (hash === '#/cctv') { document.getElementById('nav-cctv').classList.add('active'); document.getElementById('page-cctv').classList.remove('hidden'); }
    else if (hash === '#/profil') { 
        const navProfil = document.getElementById('nav-profil'); 
        if(navProfil) navProfil.classList.add('active'); 
        document.getElementById('page-profil').classList.remove('hidden'); 
    }
    else { document.getElementById('nav-qc').classList.add('active'); document.getElementById('page-qc').classList.remove('hidden'); }
};
