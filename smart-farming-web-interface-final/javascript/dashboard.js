// ============================================================
// SMART FARMING - DASHBOARD
// DATA REAL-TIME DARI FIREBASE
// ============================================================

const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const CURRENT_URL =
    DATABASE_URL + "/current.json";

const SETTINGS_URL =
    DATABASE_URL + "/settings.json";


// ============================================================
// DATA SENSOR
// ============================================================

let sensorData = {
    temperature: null,
    humidity: null,
    soil: null,
    pump: false
};


// ============================================================
// PENGATURAN
// ============================================================

let settings = {
    temperatureMin: 20,
    temperatureMax: 30,

    humidityMin: 60,
    humidityMax: 80,

    soilMin: 60,
    soilMax: 70
};


// ============================================================
// FORMAT NILAI
// ============================================================

function showValue(value, decimal = 0) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {
        return "--";
    }

    return Number(value).toFixed(decimal);
}


// ============================================================
// TANGGAL
// ============================================================

function updateDate() {

    const now = new Date();

    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    };

    const element =
        document.getElementById("currentDate");

    if (element) {
        element.textContent =
            now.toLocaleDateString("id-ID", options);
    }
}


// ============================================================
// STATUS PARAMETER
// ============================================================

function isNormal(value, min, max) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {
        return false;
    }

    return (
        Number(value) >= Number(min) &&
        Number(value) <= Number(max)
    );
}


// ============================================================
// UPDATE STATUS SENSOR
// ============================================================

function updateSensorStatus(
    statusId,
    conditionId,
    value,
    min,
    max
) {

    const statusElement =
        document.getElementById(statusId);

    const conditionElement =
        document.getElementById(conditionId);

    if (!statusElement || !conditionElement) {
        return;
    }


    // Belum ada data
    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {

        statusElement.className =
            "sensor-status warning";

        statusElement.innerHTML =
            '<i class="fa-solid fa-circle-question"></i> Menunggu Data';

        conditionElement.textContent =
            "Belum tersedia";

        return;
    }


    // Normal
    if (isNormal(value, min, max)) {

        statusElement.className =
            "sensor-status normal";

        statusElement.innerHTML =
            '<i class="fa-solid fa-circle-check"></i> Normal';

        conditionElement.textContent =
            "Normal";
    }


    // Tidak normal
    else {

        statusElement.className =
            "sensor-status warning";

        statusElement.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation"></i> Perhatian';

        conditionElement.textContent =
            "Perlu diperhatikan";
    }
}


// ============================================================
// AMBIL DATA CURRENT DARI FIREBASE
// ============================================================

async function loadCurrentData() {

    try {

        const response =
            await fetch(
                CURRENT_URL + "?t=" + Date.now(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }


        const data =
            await response.json();


        // Firebase belum mempunyai data
        if (!data) {

            console.warn(
                "Belum ada data current di Firebase."
            );

            return;
        }


        // Simpan data sensor
        sensorData.temperature =
            Number(data.temperature);

        sensorData.humidity =
            Number(data.humidity);

        sensorData.soil =
            Number(data.soil);

        sensorData.pump =
            data.pump === true;


        updateDashboard(
            data.timestamp
        );


    } catch (error) {

        console.error(
            "Gagal mengambil data Firebase:",
            error
        );
    }
}


// ============================================================
// AMBIL SETTINGS DARI FIREBASE
// ============================================================

async function loadSettings() {

    try {

        const response =
            await fetch(
                SETTINGS_URL + "?t=" + Date.now(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status
            );
        }


        const data =
            await response.json();


        if (!data) {
            return;
        }


        // Suhu
        if (data.tempMin !== undefined) {
            settings.temperatureMin =
                Number(data.tempMin);
        }

        if (data.tempMax !== undefined) {
            settings.temperatureMax =
                Number(data.tempMax);
        }


        // Kelembapan udara
        if (data.humidityMin !== undefined) {
            settings.humidityMin =
                Number(data.humidityMin);
        }

        if (data.humidityMax !== undefined) {
            settings.humidityMax =
                Number(data.humidityMax);
        }


        // Kelembapan tanah
        if (data.soilOn !== undefined) {
            settings.soilMin =
                Number(data.soilOn);
        }

        if (data.soilOff !== undefined) {
            settings.soilMax =
                Number(data.soilOff);
        }


    } catch (error) {

        console.error(
            "Gagal mengambil settings Firebase:",
            error
        );
    }
}


// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard(timestamp) {

    // --------------------------------------------------------
    // SUHU
    // --------------------------------------------------------

    const temperatureValue =
        document.getElementById("temperatureValue");

    if (temperatureValue) {

        temperatureValue.textContent =
            showValue(
                sensorData.temperature,
                1
            );
    }


    // --------------------------------------------------------
    // KELEMBAPAN UDARA
    // --------------------------------------------------------

    const humidityValue =
        document.getElementById("humidityValue");

    if (humidityValue) {

        humidityValue.textContent =
            showValue(
                sensorData.humidity,
                1
            );
    }


    // --------------------------------------------------------
    // KELEMBAPAN TANAH
    // --------------------------------------------------------

    const soilValue =
        document.getElementById("soilValue");

    if (soilValue) {

        soilValue.textContent =
            showValue(
                sensorData.soil,
                0
            );
    }


    // --------------------------------------------------------
    // STATUS SUHU
    // --------------------------------------------------------

    updateSensorStatus(
        "temperatureStatus",
        "temperatureCondition",
        sensorData.temperature,
        settings.temperatureMin,
        settings.temperatureMax
    );


    // --------------------------------------------------------
    // STATUS KELEMBAPAN UDARA
    // --------------------------------------------------------

    updateSensorStatus(
        "humidityStatus",
        "humidityCondition",
        sensorData.humidity,
        settings.humidityMin,
        settings.humidityMax
    );


    // --------------------------------------------------------
    // STATUS KELEMBAPAN TANAH
    // --------------------------------------------------------

    updateSensorStatus(
        "soilStatus",
        "soilCondition",
        sensorData.soil,
        settings.soilMin,
        settings.soilMax
    );


    // --------------------------------------------------------
    // STATUS POMPA
    // --------------------------------------------------------

    const pumpStatus =
        document.getElementById("pumpStatus");

    const pumpIndicator =
        document.getElementById("pumpIndicator");

    const pumpCondition =
        document.getElementById("pumpCondition");


    if (sensorData.pump === true) {

        if (pumpStatus) {
            pumpStatus.textContent = "HIDUP";
        }

        if (pumpIndicator) {
            pumpIndicator.classList.add("active");
        }

        if (pumpCondition) {
            pumpCondition.textContent = "Aktif";
        }

    } else {

        if (pumpStatus) {
            pumpStatus.textContent = "MATI";
        }

        if (pumpIndicator) {
            pumpIndicator.classList.remove("active");
        }

        if (pumpCondition) {
            pumpCondition.textContent =
                "Tidak Aktif";
        }
    }


    // --------------------------------------------------------
    // STATUS TANAMAN
    // --------------------------------------------------------

    const temperatureNormal =
        isNormal(
            sensorData.temperature,
            settings.temperatureMin,
            settings.temperatureMax
        );

    const humidityNormal =
        isNormal(
            sensorData.humidity,
            settings.humidityMin,
            settings.humidityMax
        );

    const soilNormal =
        isNormal(
            sensorData.soil,
            settings.soilMin,
            settings.soilMax
        );


    const plantStatus =
        document.getElementById("plantStatus");

    const plantDescription =
        document.getElementById(
            "plantStatusDescription"
        );

    const plantStatusText =
        document.getElementById(
            "plantStatusText"
        );

    const plantStatusCard =
        document.getElementById(
            "plantStatusCard"
        );


    if (
        temperatureNormal &&
        humidityNormal &&
        soilNormal
    ) {

        if (plantStatus) {
            plantStatus.textContent =
                "NORMAL";
        }

        if (plantStatusText) {
            plantStatusText.textContent =
                "Kondisi Normal";
        }

        if (plantDescription) {
            plantDescription.textContent =
                "Kondisi tanaman berada dalam batas parameter yang ditentukan.";
        }

        if (plantStatusCard) {
            plantStatusCard.classList.remove(
                "warning"
            );
        }

    } else {

        if (plantStatus) {
            plantStatus.textContent =
                "PERHATIAN";
        }

        if (plantStatusText) {
            plantStatusText.textContent =
                "Perlu Diperhatikan";
        }

        if (plantDescription) {
            plantDescription.textContent =
                "Terdapat parameter lingkungan yang berada di luar batas normal.";
        }

        if (plantStatusCard) {
            plantStatusCard.classList.add(
                "warning"
            );
        }
    }


    // --------------------------------------------------------
    // WAKTU DATA DARI FIREBASE
    // --------------------------------------------------------

    updateLastUpdate(timestamp);
}


// ============================================================
// WAKTU UPDATE
// ============================================================

function updateLastUpdate(timestamp) {

    const element =
        document.getElementById("lastUpdate");

    if (!element) {
        return;
    }


    if (timestamp) {

        element.textContent =
            timestamp;

    } else {

        element.textContent =
            new Date().toLocaleTimeString(
                "id-ID"
            );
    }
}


// ============================================================
// INISIALISASI
// ============================================================

async function initDashboard() {

    updateDate();

    // Ambil pengaturan
    await loadSettings();

    // Ambil sensor
    await loadCurrentData();
}


// Jalankan
initDashboard();


// ============================================================
// UPDATE OTOMATIS
// ============================================================

setInterval(
    loadCurrentData,
    3000
);

setInterval(
    loadSettings,
    10000
);

setInterval(
    updateDate,
    60000
);