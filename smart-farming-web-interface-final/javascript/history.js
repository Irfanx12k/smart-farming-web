// ============================================================
// SMART FARMING - HISTORY
// DATA SENSOR + RIWAYAT CNN DARI FIREBASE
// ============================================================

const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const HISTORY_URL =
    DATABASE_URL + "/history.json";

const CNN_HISTORY_URL =
    DATABASE_URL + "/cnn_history.json";

let cnnHistoryCache = [];
let selectedCNNHistoryId = null;


// ============================================================
// UTILITAS
// ============================================================

function parseDate(value) {

    if (!value) {
        return new Date(0);
    }

    const text = String(value).trim();

    // ISO sudah aman
    const direct = new Date(text);

    if (!Number.isNaN(direct.getTime())) {
        return direct;
    }

    // Format umum: YYYY-MM-DD HH:mm:ss
    const normalized =
        text.includes(" ")
            ? text.replace(" ", "T")
            : text;

    const date =
        new Date(normalized);

    return Number.isNaN(date.getTime())
        ? new Date(0)
        : date;
}


function formatDate(value) {

    const date =
        parseDate(value);

    if (date.getTime() === 0) {
        return {
            day: "-",
            time: "-"
        };
    }

    return {
        day: date.toLocaleDateString(
            "id-ID",
            {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        ),
        time: date.toLocaleTimeString(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        )
    };
}


function formatNumber(value, decimals = 1) {

    const number =
        Number(value);

    if (Number.isNaN(number)) {
        return "-";
    }

    return number.toFixed(decimals);
}


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
// HISTORY DATA SENSOR
// ============================================================

async function loadHistory() {

    const body =
        document.getElementById(
            "historyTableBody"
        );

    const empty =
        document.getElementById(
            "emptyHistory"
        );

    const count =
        document.getElementById(
            "dataCount"
        );

    if (!body) {
        return;
    }

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

            body.innerHTML = "";

            if (empty) {
                empty.style.display = "flex";
            }

            if (count) {
                count.textContent = "0";
            }

            return;
        }

        let rows =
            Object.entries(data)
                .map(
                    ([id, value]) => ({
                        id,
                        ...(value || {})
                    })
                );

        rows.sort(
            (a, b) =>
                parseDate(b.timestamp) -
                parseDate(a.timestamp)
        );

        const latestRows =
            rows.slice(0, 200);

        if (count) {
            count.textContent =
                rows.length;
        }

        if (empty) {
            empty.style.display =
                latestRows.length
                    ? "none"
                    : "flex";
        }

        body.innerHTML =
            latestRows.map(
                item => {

                    const date =
                        formatDate(
                            item.timestamp
                        );

                    const pump =
                        normalizePump(
                            item.pump
                        );

                    return `
                        <tr>

                            <td>
                                <span class="day-text">
                                    ${escapeHTML(date.day)}
                                </span>
                            </td>

                            <td>
                                <span class="time-text">
                                    ${escapeHTML(date.time)}
                                </span>
                            </td>

                            <td>
                                ${formatNumber(
                                    item.temperature,
                                    1
                                )} °C
                            </td>

                            <td>
                                ${formatNumber(
                                    item.humidity,
                                    1
                                )} %
                            </td>

                            <td>
                                ${formatNumber(
                                    item.soil,
                                    0
                                )} %
                            </td>

                            <td>
                                <span
                                    class="pump-status ${
                                        pump
                                            ? "pump-on"
                                            : "pump-off"
                                    }"
                                >
                                    <span></span>
                                    ${
                                        pump
                                            ? "ON"
                                            : "OFF"
                                    }
                                </span>
                            </td>

                        </tr>
                    `;
                }
            ).join("");

    } catch (error) {

        console.error(
            "Gagal mengambil history Firebase:",
            error
        );

        body.innerHTML = `
            <tr>
                <td colspan="6">
                    Gagal mengambil data dari Firebase.
                </td>
            </tr>
        `;

    }
}


// ============================================================
// HISTORY CNN
// ============================================================

async function loadCNNHistory() {

    const body =
        document.getElementById(
            "cnnHistoryTableBody"
        );

    const empty =
        document.getElementById(
            "emptyCnnHistory"
        );

    const count =
        document.getElementById(
            "cnnHistoryCount"
        );

    if (!body) {
        return;
    }

    try {

        const response =
            await fetch(
                CNN_HISTORY_URL +
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

            cnnHistoryCache = [];

            body.innerHTML = "";

            if (count) {
                count.textContent = "0";
            }

            if (empty) {
                empty.style.display = "flex";
            }

            return;
        }

        cnnHistoryCache =
            Object.entries(data)
                .map(
                    ([id, value]) => ({
                        id,
                        ...(value || {})
                    })
                )
                .sort(
                    (a, b) =>
                        parseDate(b.timestamp) -
                        parseDate(a.timestamp)
                );

        if (count) {
            count.textContent =
                cnnHistoryCache.length;
        }

        if (empty) {
            empty.style.display =
                cnnHistoryCache.length
                    ? "none"
                    : "flex";
        }

        body.innerHTML =
            cnnHistoryCache.map(
                item => {

                    const date =
                        formatDate(
                            item.timestamp
                        );

                    const prediction =
                        item.cnn?.prediction ||
                        "Belum dianalisis";

                    const status =
                        item.cnn?.status ||
                        (
                            item.cnn?.prediction
                                ? "Selesai"
                                : "Menunggu model"
                        );

                    const source =
                        item.source === "esp32cam"
                            ? "ESP32-CAM"
                            : "Upload";

                    const statusClass =
                        item.cnn?.prediction
                            ? "cnn-status-done"
                            : "cnn-status-waiting";

                    return `
                        <tr>

                            <td>
                                ${escapeHTML(date.day)}
                            </td>

                            <td>
                                ${escapeHTML(date.time)}
                            </td>

                            <td>
                                ${source}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHTML(prediction)}
                                </strong>
                            </td>

                            <td>
                                ${confidenceText(
                                    item.cnn?.confidence
                                )}
                            </td>

                            <td>
                                <span class="${statusClass}">
                                    ${escapeHTML(status)}
                                </span>
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="history-detail-button"
                                    data-cnn-id="${escapeHTML(item.id)}"
                                >
                                    Detail
                                </button>
                            </td>

                        </tr>
                    `;
                }
            ).join("");

        bindCNNDetailButtons();

    } catch (error) {

        console.error(
            "Gagal mengambil history CNN:",
            error
        );

        body.innerHTML = `
            <tr>
                <td colspan="7">
                    Gagal mengambil riwayat CNN dari Firebase.
                </td>
            </tr>
        `;

    }
}


// ============================================================
// DETAIL CNN
// ============================================================

function bindCNNDetailButtons() {

    document
        .querySelectorAll(
            ".history-detail-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const id =
                            this.dataset.cnnId;

                        openCNNDetail(id);

                    }
                );

            }
        );
}


function openCNNDetail(id) {

    const item =
        cnnHistoryCache.find(
            entry =>
                String(entry.id) ===
                String(id)
        );

    if (!item) {
        return;
    }

    selectedCNNHistoryId =
        item.id;

    const modal =
        document.getElementById(
            "cnnDetailModal"
        );

    if (!modal) {
        return;
    }

    const date =
        formatDate(
            item.timestamp
        );

    const image =
        document.getElementById(
            "cnnDetailImage"
        );

    if (image) {

        image.src =
            item.image ||
            item.imageUrl ||
            "";

        image.alt =
            "Foto tanaman " +
            date.day;
    }

    const title =
        document.getElementById(
            "cnnDetailTitle"
        );

    if (title) {
        title.textContent =
            item.cnn?.prediction
                ? "Detail Analisis CNN"
                : "Detail Foto Tanaman";
    }

    setText(
        "cnnDetailSubtitle",
        `${date.day} • ${date.time}`
    );

    setText(
        "cnnDetailPrediction",
        item.cnn?.prediction ||
        "Belum dianalisis"
    );

    setText(
        "cnnDetailConfidence",
        item.cnn?.maturityPercent !== null &&
        item.cnn?.maturityPercent !== undefined
            ? "Tingkat kematangan: " +
              Number(
                  item.cnn.maturityPercent
              ).toFixed(1) +
              "%"
            : "Tingkat kematangan: --"
    );

    setText(
        "cnnDetailSource",
        item.source === "esp32cam"
            ? "ESP32-CAM"
            : "Upload"
    );

    setText(
        "cnnDetailAnalysisStatus",
        item.cnn?.status ||
        (
            item.cnn?.prediction
                ? "Selesai"
                : "Menunggu model CNN"
        )
    );

    setText(
        "cnnDetailLeafWidth",
        formatMeasurement(
            item.cnn?.leafWidthCm,
            "cm"
        )
    );

    setText(
        "cnnDetailLeafArea",
        formatMeasurement(
            item.cnn?.leafAreaRatio,
            "%"
        )
    );

    setText(
        "cnnDetailMaturity",
        formatMeasurement(
            item.cnn?.maturityPercent,
            "%"
        )
    );

    setText(
        "cnnDetailTime",
        `${date.day} ${date.time}`
    );

    setText(
        "cnnDetailTemperature",
        formatMeasurement(
            item.sensor?.temperature,
            "°C"
        )
    );

    setText(
        "cnnDetailHumidity",
        formatMeasurement(
            item.sensor?.humidity,
            "%"
        )
    );

    setText(
        "cnnDetailSoil",
        formatMeasurement(
            item.sensor?.soil,
            "%"
        )
    );

    setText(
        "cnnDetailPump",
        normalizePump(
            item.sensor?.pump
        )
            ? "ON"
            : "OFF"
    );


    // Data tambahan dari model CNN
    const extra =
        document.getElementById(
            "cnnDetailExtra"
        );

    if (extra) {

        const measurements =
            item.cnn?.measurements ||
            {};

        const entries =
            Object.entries(
                measurements
            );

        extra.innerHTML =
            entries.length
                ? `
                    <h3>Hasil Pengukuran Tambahan</h3>
                    <div class="cnn-extra-grid">
                        ${
                            entries.map(
                                ([key, value]) => `
                                    <div>
                                        <span>
                                            ${escapeHTML(
                                                key
                                            )}
                                        </span>
                                        <strong>
                                            ${escapeHTML(
                                                value
                                            )}
                                        </strong>
                                    </div>
                                `
                            ).join("")
                        }
                    </div>
                `
                : "";
    }


    const analyzeButton =
        document.getElementById(
            "cnnAnalyzeAgainButton"
        );

    if (analyzeButton) {

        analyzeButton.style.display =
            item.cnn?.prediction
                ? "none"
                : "inline-flex";

    }


    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value;
    }
}


function formatMeasurement(value, unit = "") {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--";
    }

    const number =
        Number(value);

    if (Number.isNaN(number)) {
        return String(value);
    }

    return (
        number.toFixed(1) +
        (unit ? " " + unit : "")
    );
}


function closeCNNDetail() {

    const modal =
        document.getElementById(
            "cnnDetailModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    selectedCNNHistoryId = null;
}


// ============================================================
// MODAL EVENTS
// ============================================================

function initCNNDetailModal() {

    const closeButton =
        document.getElementById(
            "cnnDetailClose"
        );

    const backdrop =
        document.getElementById(
            "cnnDetailBackdrop"
        );

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeCNNDetail
        );
    }

    if (backdrop) {
        backdrop.addEventListener(
            "click",
            closeCNNDetail
        );
    }

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {
                closeCNNDetail();
            }

        }
    );
}


// ============================================================
// LOAD
// ============================================================

function updateDate() {

    const element =
        document.getElementById(
            "currentDate"
        );

    if (element) {

        element.textContent =
            new Date().toLocaleDateString(
                "id-ID",
                {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }
            );
    }
}


async function initHistoryPage() {

    updateDate();

    initCNNDetailModal();

    await Promise.all([
        loadHistory(),
        loadCNNHistory()
    ]);

    const update =
        document.getElementById(
            "lastUpdate"
        );

    if (update) {
        update.textContent =
            new Date().toLocaleTimeString(
                "id-ID"
            );
    }
}


initHistoryPage();


setInterval(
    async function () {

        await Promise.all([
            loadHistory(),
            loadCNNHistory()
        ]);

        const update =
            document.getElementById(
                "lastUpdate"
            );

        if (update) {
            update.textContent =
                new Date().toLocaleTimeString(
                    "id-ID"
                );
        }

    },
    10000
);
