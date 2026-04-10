/*
  Version: 8.3.0
  Date: 2026-04-10
  Changelog:
  - MODULE: Dedicated Chart.js rendering module.
  - THEME: Fully adapted to Onyx Gemstone Dark Mode palette.
*/
import Chart from 'chart.js/auto';

let progChart = null;
let distChart = null;
let ageChart = null;

export const renderCharts = (summary) => {
    // Onyx Theme Colors
    const textColor = '#9ca3af'; // var(--text-muted)
    const gridColor = '#2c3135'; // var(--border-light)
    const fontConfig = { family: "'Segoe UI', Tahoma, sans-serif", size: 11 };

    // 1. Progressive Line Chart
    const ctxProg = document.getElementById('progressive-line-chart');
    if (ctxProg) {
        if (progChart) progChart.destroy();
        progChart = new Chart(ctxProg, {
            type: 'line',
            data: {
                labels: summary.dates,
                datasets: [
                    {
                        label: 'Produksi Aktual',
                        data: summary.cumulativeCounts,
                        borderColor: '#4b5563', // Slate accent
                        backgroundColor: 'rgba(75, 85, 99, 0.2)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointBackgroundColor: '#e5e7eb'
                    },
                    {
                        label: 'Target Kumulatif',
                        data: summary.targetCounts,
                        borderColor: '#9b2c2c', // Muted Terracotta
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#e5e7eb', font: fontConfig } } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: fontConfig } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: fontConfig }, beginAtZero: true }
                }
            }
        });
    }

    // 2. Distribusi Status (Doughnut Chart)
    const ctxDist = document.getElementById('failure-doughnut-chart');
    if (ctxDist) {
        if (distChart) distChart.destroy();
        distChart = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['Produksi', 'Aktif', 'Gagal: Chip', 'Gagal: Driver', 'Gagal: Solder'],
                datasets: [{
                    data: [
                        summary.statusCount.produksi,
                        summary.statusCount.active,
                        summary.statusCount.dead_chip,
                        summary.statusCount.dead_driver,
                        summary.statusCount.dead_solder
                    ],
                    backgroundColor: [
                        '#475569', // Deep Slate
                        '#059669', // Sage Green
                        '#9b2c2c', // Terracotta
                        '#92400e', // Amber
                        '#374151'  // Monochrome
                    ],
                    borderWidth: 1,
                    borderColor: '#111416' // var(--surface-card)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { 
                    legend: { position: 'right', labels: { color: '#e5e7eb', font: { size: 10, family: fontConfig.family }, boxWidth: 12 } } 
                }
            }
        });
    }

    // 3. Rata-rata Umur (Bar Chart)
    const ctxAge = document.getElementById('avg-age-batch-chart');
    if (ctxAge) {
        if (ageChart) ageChart.destroy();
        const batches = Object.keys(summary.batchAgeData);
        const ages = Object.values(summary.batchAgeData);
        ageChart = new Chart(ctxAge, {
            type: 'bar',
            data: {
                labels: batches.length > 0 ? batches : ['Tidak ada data'],
                datasets: [{
                    label: 'Umur (Hari)',
                    data: ages.length > 0 ? ages : [0],
                    backgroundColor: '#475569',
                    borderRadius: 4,
                    hoverBackgroundColor: '#e5e7eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10, family: fontConfig.family } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: fontConfig }, beginAtZero: true }
                }
            }
        });
    }
};
