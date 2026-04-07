/*
  Version: 1.4.0
  Date: 2026-04-08
  Changelog:
  - Added 'Produksi' state to Doughnut chart distribution.
*/
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let progressiveChart, doughnutChart, barChart;

export const renderCharts = (dataSummary) => {
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#111827' } } },
        scales: {
            x: { 
                ticks: { 
                    color: '#6b7280', maxRotation: 45,
                    callback: function(val) {
                        const lbl = this.getLabelForValue(val);
                        return (typeof lbl === 'string' && lbl.length > 15) ? lbl.substring(0, 15) + '...' : lbl;
                    }
                }, 
                grid: { color: '#e5e7eb' } 
            },
            y: { ticks: { color: '#6b7280' }, grid: { color: '#e5e7eb' } }
        }
    };

    const ctxLine = document.getElementById('progressive-line-chart').getContext('2d');
    if (progressiveChart) progressiveChart.destroy();
    progressiveChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: dataSummary.dates,
            datasets: [
                { label: 'Target Kumulatif', data: dataSummary.targetCounts, borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1.5, radius: 0, fill: false, tension: 0.1 },
                { label: 'Produksi Aktual', data: dataSummary.cumulativeCounts, borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1.5, radius: 0, fill: false, tension: 0.1 }
            ]
        },
        options: { ...commonOptions, animation: { x: { type: 'number', easing: 'linear', duration: 1000 }, y: { type: 'number', easing: 'linear', duration: 1000 } } }
    });

    // Update Doughnut Chart
    const ctxDoughnut = document.getElementById('failure-doughnut-chart').getContext('2d');
    if (doughnutChart) doughnutChart.destroy();
    doughnutChart = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['Produksi', 'Aktif', 'Gagal: Chip', 'Gagal: Driver', 'Gagal: Solder'],
            datasets: [{
                data: [
                    dataSummary.statusCount.produksi,
                    dataSummary.statusCount.active,
                    dataSummary.statusCount.dead_chip,
                    dataSummary.statusCount.dead_driver,
                    dataSummary.statusCount.dead_solder
                ],
                // Warna: Indigo (Produksi), Hijau (Aktif), Merah, Orange, Ungu (Gagal)
                backgroundColor: ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    const ctxBar = document.getElementById('avg-age-batch-chart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: Object.keys(dataSummary.batchAgeData),
            datasets: [{ label: 'Rata-rata Umur (Hari)', data: Object.values(dataSummary.batchAgeData), backgroundColor: '#3b82f6', borderRadius: 4 }]
        },
        options: commonOptions
    });
};
