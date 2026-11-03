
/*
============================================================
SMART FARMING - PENGATURAN
============================================================

Firebase Realtime Database
Project:
selada-a9428

Data pengaturan disimpan pada:
settings/
*/


// ==========================================================
// FIREBASE DATABASE
// ==========================================================

const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const SETTINGS_URL =
    DATABASE_URL + "/settings.json";


// ==========================================================
// FIELD PENGATURAN
// ==========================================================

const fields = [
    "soilOn",
    "soilOff",
    "humidityMin",
    "humidityMax",
    "tempMin",
    "tempMax",
    "startTime",
    "endTime"
];


// ==========================================================
// ELEMENT HTML
// ==========================================================

const saveButton =
    document.getElementById("saveButton");

const message =
    document.getElementById("message");


// ==========================================================
// LOAD PENGATURAN
// ==========================================================

async function loadSettings() {

    try {

        showMessage(
            "Mengambil pengaturan dari Firebase...",
            "loading"
        );


        const response = await fetch(
            SETTINGS_URL,
            {
                method: "GET",
                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                "HTTP " + response.status
            );

        }


        const settings =
            await response.json();


        // --------------------------------------------------
        // Jika Firebase belum memiliki data settings
        // --------------------------------------------------

        if (settings === null) {

            console.log(
                "Data settings belum tersedia di Firebase."
            );

            loadLocalSettings();

            showMessage(
                "Firebase belum memiliki pengaturan. Menggunakan nilai lokal.",
                "loading"
            );

            return;
        }


        // --------------------------------------------------
        // Masukkan data Firebase ke form
        // --------------------------------------------------

        fields.forEach((field) => {

            const element =
                document.getElementById(field);

            if (
                element &&
                settings[field] !== undefined &&
                settings[field] !== null
            ) {

                element.value =
                    settings[field];

            }

        });


        // Simpan juga ke localStorage
        // sebagai cache lokal

        fields.forEach((field) => {

            const element =
                document.getElementById(field);

            if (element) {

                localStorage.setItem(
                    field,
                    element.value
                );

            }

        });


        showMessage(
            "Pengaturan berhasil dimuat dari Firebase.",
            "success"
        );


    } catch (error) {

        console.error(
            "Gagal mengambil pengaturan:",
            error
        );


        // Jika Firebase gagal,
        // gunakan data lokal sebagai cadangan

        loadLocalSettings();


        showMessage(
            "Firebase tidak dapat diakses. Menggunakan pengaturan lokal.",
            "error"
        );

    }

}


// ==========================================================
// LOAD LOCAL STORAGE
// ==========================================================

function loadLocalSettings() {

    fields.forEach((field) => {

        const savedValue =
            localStorage.getItem(field);

        const element =
            document.getElementById(field);

        if (
            savedValue !== null &&
            element
        ) {

            element.value =
                savedValue;

        }

    });

}


// ==========================================================
// AMBIL NILAI FORM
// ==========================================================

function getSettingsFromForm() {

    return {

        soilOn: Number(
            document.getElementById("soilOn").value
        ),

        soilOff: Number(
            document.getElementById("soilOff").value
        ),

        humidityMin: Number(
            document.getElementById("humidityMin").value
        ),

        humidityMax: Number(
            document.getElementById("humidityMax").value
        ),

        tempMin: Number(
            document.getElementById("tempMin").value
        ),

        tempMax: Number(
            document.getElementById("tempMax").value
        ),

        startTime:
            document.getElementById("startTime").value,

        endTime:
            document.getElementById("endTime").value

    };

}


// ==========================================================
// VALIDASI
// ==========================================================

function validateSettings(settings) {


    // ------------------------------------------------------
    // KELEMBAPAN TANAH
    // ------------------------------------------------------

    if (
        settings.soilOn < 0 ||
        settings.soilOn > 100 ||
        settings.soilOff < 0 ||
        settings.soilOff > 100
    ) {

        return "Kelembapan tanah harus berada antara 0-100%.";

    }


    if (
        settings.soilOn >= settings.soilOff
    ) {

        return (
            "Batas kelembapan ON harus lebih kecil dari OFF."
        );

    }


    // ------------------------------------------------------
    // KELEMBAPAN UDARA
    // ------------------------------------------------------

    if (
        settings.humidityMin < 0 ||
        settings.humidityMin > 100 ||
        settings.humidityMax < 0 ||
        settings.humidityMax > 100
    ) {

        return (
            "Kelembapan udara harus berada antara 0-100%."
        );

    }


    if (
        settings.humidityMin >=
        settings.humidityMax
    ) {

        return (
            "Kelembapan minimum harus lebih kecil dari maksimum."
        );

    }


    // ------------------------------------------------------
    // SUHU
    // ------------------------------------------------------

    if (
        settings.tempMin >=
        settings.tempMax
    ) {

        return (
            "Suhu minimum harus lebih kecil dari maksimum."
        );

    }


    // ------------------------------------------------------
    // JADWAL
    // ------------------------------------------------------

    if (
        !settings.startTime ||
        !settings.endTime
    ) {

        return (
            "Waktu mulai dan waktu selesai harus diisi."
        );

    }


    if (
        settings.startTime ===
        settings.endTime
    ) {

        return (
            "Waktu mulai dan selesai tidak boleh sama."
        );

    }


    return null;

}


// ==========================================================
// SIMPAN KE FIREBASE
// ==========================================================

async function saveSettings() {

    const settings =
        getSettingsFromForm();


    // ------------------------------------------------------
    // VALIDASI
    // ------------------------------------------------------

    const validationError =
        validateSettings(settings);


    if (validationError) {

        showMessage(
            validationError,
            "error"
        );

        return;

    }


    // ------------------------------------------------------
    // DISABLE BUTTON
    // ------------------------------------------------------

    saveButton.disabled = true;

    saveButton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> MENYIMPAN...';


    showMessage(
        "Menyimpan pengaturan ke Firebase...",
        "loading"
    );


    try {

        // --------------------------------------------------
        // SIMPAN KE FIREBASE
        // --------------------------------------------------

        const response =
            await fetch(
                SETTINGS_URL,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(settings)
                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();

            throw new Error(
                "HTTP " +
                response.status +
                ": " +
                errorText
            );

        }


        // --------------------------------------------------
        // SIMPAN CACHE LOKAL
        // --------------------------------------------------

        fields.forEach((field) => {

            localStorage.setItem(
                field,
                settings[field]
            );

        });


        showMessage(
            "Pengaturan berhasil disimpan ke Firebase.",
            "success"
        );


    } catch (error) {

        console.error(
            "Gagal menyimpan ke Firebase:",
            error
        );


        showMessage(
            "Gagal menyimpan ke Firebase. Periksa koneksi atau Firebase Rules.",
            "error"
        );

    }


    // ------------------------------------------------------
    // KEMBALIKAN BUTTON
    // ------------------------------------------------------

    saveButton.disabled = false;

    saveButton.innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> SIMPAN PENGATURAN';

}


// ==========================================================
// PESAN
// ==========================================================

function showMessage(
    text,
    type
) {

    message.textContent =
        text;

    message.className =
        "";

    message.classList.add(
        type
    );


    if (
        type === "success"
    ) {

        setTimeout(() => {

            message.textContent =
                "";

            message.className =
                "";

        }, 4000);

    }

}


// ==========================================================
// EVENT SIMPAN
// ==========================================================

saveButton.addEventListener(
    "click",
    saveSettings
);


// ==========================================================
// LOAD SAAT HALAMAN DIBUKA
// ==========================================================

loadSettings();
