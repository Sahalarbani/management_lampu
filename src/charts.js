/*
  Version: 1.3.0
  Date: 2026-04-07
  Changelog:
  - Fixed chart shrinking issue caused by long labels (overflow text wrapping).
  - Added tick callback to dynamically truncate long x-axis labels with ellipsis.
  - Enforced maxRotation to keep layout container height stable.
*/
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let progressiveChart, doughnutChart, barChart;

export const renderCharts = (dataSummary) => {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
            legend: { labels: { color: '#111827' } } 
        },
        scales: {
            x: { 
                ticks: { 
                    color: '#6b7280',
                    maxRotation: 45, // Batasi kemiringan biar gak makan tempat
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        // Potong teks jika lebih dari 15 karakter biar chart gak menciut
                        if (typeof label === 'string' && label.length > 15) {
                            return label.substring(0, 15) + '...';
                        }
                        return label;
                    }
                }, 
                grid: { color: '#e5e7eb' } 
            },
            y: { 
                ticks: { color: '#6b7280' }, 
                grid: { color: '#e5e7eb' } 
            }
        }
    };

    // 1. Progressive Line Chart
    const ctxLine = document.getElementById('progressive-line-chart').getContext('2d');
    if (progressiveChart) progressiveChart.destroy();
    progressiveChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: dataSummary.dates,
            datasets: [
                {
                    label: 'Target Kumulatif',
                    data: dataSummary.targetCounts,
                    borderColor: 'rgba(255, 99, 132, 1)', // Merah
                    borderWidth: 1.5,
                    radius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Produksi Aktual',
                    data: dataSummary.cumulativeCounts,
                    borderColor: 'rgba(54, 162, 235, 1)', // Biru
                    borderWidth: 1.5,
                    radius: 0,
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            animation: { x: { type: 'number', easing: 'linear', duration: 1000 }, y: { type: 'number', easing: 'linear', duration: 1000 } }
        }
    });

    // 2. Distribusi Kegagalan (Doughnut)
    const ctxDoughnut = document.getElementById('failure-doughnut-chart').getContext('2d');
    if (doughnutChart) doughnutChart.destroy();
    doughnutChart = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['Aktif', 'Gagal: Chip', 'Gagal: Driver', 'Gagal: Solder'],
            datasets: [{
                data: [
                    dataSummary.statusCount.active,
                    dataSummary.statusCount.dead_chip,
                    dataSummary.statusCount.dead_driver,
                    dataSummary.statusCount.dead_solder
                ],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#6366f1'],
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // 3. Rata-rata Umur per Batch (Bar)
    const ctxBar = document.getElementById('avg-age-batch-chart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: Object.keys(dataSummary.batchAgeData),
            datasets: [{
                label: 'Rata-rata Umur (Hari)',
                data: Object.values(dataSummary.batchAgeData),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: commonOptions
    });
};
