// ============================================================
// SMART FARMING - MONITORING
// FIREBASE + GRAFIK REAL-TIME + LSTM READY + ESP32-CAM + CNN
// ============================================================

const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const CURRENT_URL =
    DATABASE_URL + "/current.json";

const HISTORY_URL =
    DATABASE_URL + "/history.json";

const CNN_HISTORY_URL =
    DATABASE_URL + "/cnn_history.json";

const LSTM_URL =
    DATABASE_URL + "/lstm/latest.json";

// Backend Python CNN.
// Saat model CNN/API sudah siap, endpoint ini akan mengembalikan
// prediction, confidence, dan pengukuran citra.
const CNN_API_URL =
    "http://127.0.0.1:5000/predict";


// ============================================================
// CHART
// ============================================================

let realtimeChart = null;
let predictionChart = null;


// ============================================================
// KAMERA
// ============================================================

let cameraIP = "";


// ============================================================
// SENSOR TERBARU
// ============================================================

let latestSensorData = {
    temperature: null,
    humidity: null,
    soil: null,
    pump: false,
    timestamp: null
};


// ============================================================
// CNN CACHE
// ============================================================

let cnnSnapshots = [];


// ============================================================
// UTILITAS
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function normalizePump(value) {

    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true" ||
        String(value).toLowerCase() === "on"
    );
}


function formatNumber(value, decimals = 1) {

    const number =
        Number(value);

    if (Number.isNaN(number)) {
        return "--";
    }

    return number.toFixed(decimals);
}


function confidenceText(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--";
    }

    let number =
        Number(value);

    if (Number.isNaN(number)) {
        return String(value);
    }

    if (number <= 1) {
        number *= 100;
    }

    return number.toFixed(1) + "%";
}


// ============================================================
// FIREBASE REQUEST
// ============================================================

async function firebaseRequest(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                ...options,
                headers: {
                    "Content-Type":
                        "application/json",
                    ...(options.headers || {})
                }
            }
        );

    if (!response.ok) {

        throw new Error(
            "Firebase HTTP " +
            response.status
        );
    }

    return response;
}


// ============================================================
// CURRENT SENSOR
// ============================================================

async function loadCurrent() {

    try {

        const response =
            await fetch(
                CURRENT_URL +
                "?t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        if (!data) {
            return;
        }

        updateCurrentUI(data);

    } catch (error) {

        console.error(
            "Gagal mengambil current Firebase:",
            error
        );

    }
}


// ============================================================
// UPDATE SENSOR
// ============================================================

function updateCurrentUI(data) {

    const temperature =
        Number(data.temperature);

    const humidity =
        Number(data.humidity);

    const soil =
        Number(data.soil);

    const pump =
        normalizePump(data.pump);


    latestSensorData = {

        temperature:
            Number.isNaN(temperature)
                ? null
                : temperature,

        humidity:
            Number.isNaN(humidity)
                ? null
                : humidity,

        soil:
            Number.isNaN(soil)
                ? null
                : soil,

        pump,

        timestamp:
            data.timestamp ||
            new Date().toISOString()

    };


    // --------------------------------------------------------
    // CARD SENSOR
    // --------------------------------------------------------

    const temperatureElement =
        document.getElementById(
            "temperature"
        );

    const humidityElement =
        document.getElementById(
            "humidity"
        );

    const soilElement =
        document.getElementById(
            "soil"
        );


    if (temperatureElement) {

        temperatureElement.textContent =
            Number.isNaN(temperature)
                ? "--"
                : temperature.toFixed(1);

    }


    if (humidityElement) {

        humidityElement.textContent =
            Number.isNaN(humidity)
                ? "--"
                : humidity.toFixed(1);

    }


    if (soilElement) {

        soilElement.textContent =
            Number.isNaN(soil)
                ? "--"
                : Math.round(soil);

    }


    // --------------------------------------------------------
    // POMPA
    // --------------------------------------------------------

    const pumpStatus =
        document.getElementById(
            "pumpStatus"
        );

    if (pumpStatus) {

        pumpStatus.textContent =
            pump
                ? "HIDUP"
                : "MATI";

    }


    // --------------------------------------------------------
    // UPDATE TERAKHIR
    // --------------------------------------------------------

    const lastUpdate =
        document.getElementById(
            "lastUpdate"
        );

    if (lastUpdate) {

        const timestamp =
            data.timestamp ||
            new Date().toLocaleTimeString(
                "id-ID"
            );

        lastUpdate.textContent =
            timestamp;

    }

}


// ============================================================
// GRAFIK REAL-TIME
// ============================================================

async function loadHistoryChart() {

    try {

        const response =
            await fetch(
                HISTORY_URL +
                "?t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "HTTP " +
                response.status
            );
        }

        const data =
            await response.json();

        if (!data) {
            return;
        }

        let rows =
            Object.values(data)
                .filter(
                    item =>
                        item &&
                        item.timestamp !== undefined
                );


        rows.sort(
            (a, b) => {

                return (
                    new Date(
                        String(
                            a.timestamp
                        ).replace(
                            " ",
                            "T"
                        )
                    )
                    -
                    new Date(
                        String(
                            b.timestamp
                        ).replace(
                            " ",
                            "T"
                        )
                    )
                );

            }
        );


        rows =
            rows.slice(-20);


        if (!rows.length) {
            return;
        }


        const labels =
            rows.map(
                item => {

                    const timestamp =
                        String(
                            item.timestamp ||
                            ""
                        );

                    if (
                        timestamp.includes(" ")
                    ) {

                        return timestamp
                            .split(" ")[1]
                            .substring(0, 8);

                    }

                    return timestamp;

                }
            );


        const temperatures =
            rows.map(
                item =>
                    Number(
                        item.temperature
                    )
            );


        const humidities =
            rows.map(
                item =>
                    Number(
                        item.humidity
                    )
            );


        const soils =
            rows.map(
                item =>
                    Number(
                        item.soil
                    )
            );


        createRealtimeChart(
            labels,
            temperatures,
            humidities,
            soils
        );


    } catch (error) {

        console.error(
            "Gagal mengambil history Firebase:",
            error
        );

    }
}


function createRealtimeChart(
    labels,
    temperatures,
    humidities,
    soils
) {

    const canvas =
        document.getElementById(
            "realtimeChart"
        );

    if (!canvas) {
        return;
    }


    if (realtimeChart) {
        realtimeChart.destroy();
    }


    realtimeChart =
        new Chart(
            canvas.getContext("2d"),
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {
                            label:
                                "Suhu Udara (°C)",
                            data:
                                temperatures,
                            tension:
                                0.35,
                            borderWidth:
                                2,
                            pointRadius:
                                2,
                            fill:
                                false
                        },

                        {
                            label:
                                "Kelembapan Udara (%)",
                            data:
                                humidities,
                            tension:
                                0.35,
                            borderWidth:
                                2,
                            pointRadius:
                                2,
                            fill:
                                false
                        },

                        {
                            label:
                                "Kelembapan Tanah (%)",
                            data:
                                soils,
                            tension:
                                0.35,
                            borderWidth:
                                2,
                            pointRadius:
                                2,
                            fill:
                                false
                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    interaction: {

                        mode:
                            "index",

                        intersect:
                            false

                    },

                    plugins: {

                        legend: {

                            display:
                                true,

                            position:
                                "top"

                        }

                    },

                    scales: {

                        x: {

                            title: {

                                display:
                                    true,

                                text:
                                    "Waktu"

                            }

                        },

                        y: {

                            beginAtZero:
                                true

                        }

                    }

                }

            }
        );

}



// ============================================================
// INISIALISASI MONITORING SENSOR SAJA
// ============================================================

async function initMonitoring() {
    await loadCurrent();
    await loadHistoryChart();
}

initMonitoring();

setInterval(loadCurrent, 3000);
setInterval(loadHistoryChart, 10000);
