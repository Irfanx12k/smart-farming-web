// ============================================================
// SMART FARMING - LSTM
// Hanya membaca hasil prediksi nyata dari Firebase.
// ============================================================

const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const LSTM_URL =
    DATABASE_URL + "/lstm/latest.json";

let predictionChart = null;

function el(id) {
    return document.getElementById(id);
}

function setDate() {
    const target = el("currentDate");
    if (target) {
        target.textContent = new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }
}

function createPredictionPlaceholder() {
    const canvas = el("predictionChart");
    const empty = el("predictionEmpty");

    if (!canvas || typeof Chart === "undefined") return;

    if (predictionChart) predictionChart.destroy();

    if (empty) empty.style.display = "flex";

    predictionChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Prediksi LSTM",
                data: [],
                borderColor: "#8b5cf6",
                backgroundColor: "rgba(139,92,246,.10)",
                borderWidth: 3,
                pointRadius: 3,
                tension: .35,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: "Waktu prediksi" } },
                y: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: "Tingkat perkembangan (%)" }
                }
            }
        }
    });
}

function createLSTMChart(forecast) {
    const canvas = el("predictionChart");
    const empty = el("predictionEmpty");

    if (!canvas || typeof Chart === "undefined") return;

    const labels = forecast.map(item => {
        const date = new Date(String(item.timestamp || "").replace(" ", "T"));
        return Number.isNaN(date.getTime())
            ? String(item.timestamp || "")
            : date.toLocaleString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });
    });

    const values = forecast.map(item => Number(item.predicted_maturity));

    if (predictionChart) predictionChart.destroy();
    if (empty) empty.style.display = "none";

    predictionChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Prediksi LSTM",
                data: values,
                borderColor: "#8b5cf6",
                backgroundColor: "rgba(139,92,246,.10)",
                borderWidth: 3,
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: .35,
                borderDash: [6,5],
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { display: true, position: "top" },
                tooltip: {
                    callbacks: {
                        label: context => `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}%`
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: "Waktu / Hari" } },
                y: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: "Tingkat perkembangan (%)" }
                }
            }
        }
    });
}

function renderSummary(forecast) {
    const box = el("lstmSummary");
    if (!box) return;

    const days = {};
    forecast.forEach(item => {
        const day = Number(item.day) || 1;
        if (!days[day]) days[day] = [];
        days[day].push(item);
    });

    const dayKeys = Object.keys(days).sort((a,b) => Number(a)-Number(b)).slice(0,4);

    box.innerHTML = dayKeys.map(day => {
        const values = days[day]
            .map(item => Number(item.predicted_maturity))
            .filter(Number.isFinite);

        const avg = values.length
            ? values.reduce((a,b)=>a+b,0)/values.length
            : null;

        return `
            <div class="lstm-summary-card">
                <span>Hari ke-${day}</span>
                <strong>${avg === null ? "--" : avg.toFixed(2) + "%"}</strong>
                <small>${values.length} hasil prediksi</small>
            </div>
        `;
    }).join("");

    if (!dayKeys.length) {
        box.innerHTML = `<div class="empty-photo"><i class="fa-solid fa-chart-line"></i><p>Belum ada hasil prediksi.</p></div>`;
    }
}

async function loadLSTMPrediction() {
    try {
        const response = await fetch(LSTM_URL + "?t=" + Date.now(), {
            cache: "no-store"
        });

        if (!response.ok) throw new Error("Firebase HTTP " + response.status);

        const data = await response.json();

        if (!data || !Array.isArray(data.forecast)) {
            createPredictionPlaceholder();
            return;
        }

        const forecast = data.forecast.filter(item =>
            item &&
            item.timestamp &&
            Number.isFinite(Number(item.predicted_maturity))
        );

        if (!forecast.length) {
            createPredictionPlaceholder();
            return;
        }

        createLSTMChart(forecast);
        renderSummary(forecast);

        const updated = el("lstmUpdated");
        if (updated) {
            updated.innerHTML = `<span></span> Diperbarui ${data.updatedAt ? new Date(data.updatedAt).toLocaleString("id-ID") : ""}`;
        }
    } catch (error) {
        console.error("Gagal mengambil prediksi LSTM:", error);
        createPredictionPlaceholder();
    }
}

setDate();
createPredictionPlaceholder();
loadLSTMPrediction();
setInterval(loadLSTMPrediction, 30000);
