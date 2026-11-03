// ============================================================
// SMART FARMING - CNN
// Kamera ESP32-CAM + upload foto + analisis lebar daun
// Data disimpan ke Firebase /cnn_history
// ============================================================

const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const CNN_HISTORY_URL =
    DATABASE_URL + "/cnn_history.json";

const CURRENT_URL =
    DATABASE_URL + "/current.json";

const CALIBRATION_PX_PER_CM = 40;

let cameraIP = "";
let latestSensorData = {
    temperature: null,
    humidity: null,
    soil: null,
    pump: null
};

function el(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setStatus(text, active = false) {
    if (el("cameraStatus")) el("cameraStatus").textContent = text;
    if (el("cameraStatusDot")) {
        el("cameraStatusDot").style.background = active ? "#22c55e" : "#94a3b8";
    }
}

async function loadCurrentSensor() {
    try {
        const response = await fetch(CURRENT_URL + "?t=" + Date.now(), {
            cache: "no-store"
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!data) return;

        latestSensorData = {
            temperature: Number.isFinite(Number(data.temperature)) ? Number(data.temperature) : null,
            humidity: Number.isFinite(Number(data.humidity)) ? Number(data.humidity) : null,
            soil: Number.isFinite(Number(data.soil)) ? Number(data.soil) : null,
            pump: data.pump
        };
    } catch (error) {
        console.error("Gagal membaca sensor saat analisis CNN:", error);
    }
}

function compressImage(dataUrl, maxWidth = 900, quality = 0.78) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.naturalWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function analyzeLeafWidth(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);

            let imageData;
            try {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch (error) {
                reject(new Error("Foto tidak dapat dibaca oleh browser."));
                return;
            }

            const { data, width, height } = imageData;
            let minX = width;
            let maxX = -1;
            let minY = height;
            let maxY = -1;
            let greenCount = 0;

            // Segmentasi hijau sederhana.
            // Tidak mengubah foto asli; hanya membaca piksel untuk pengukuran.
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    const isGreen =
                        g > r * 1.08 &&
                        g > b * 1.05 &&
                        g > 45 &&
                        (g - r) > 8;

                    if (isGreen) {
                        greenCount++;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            if (maxX < 0 || greenCount < 50) {
                reject(new Error("Area daun hijau tidak ditemukan pada foto."));
                return;
            }

            const widthPx = maxX - minX + 1;
            const heightPx = maxY - minY + 1;
            const widthCm = widthPx / CALIBRATION_PX_PER_CM;

            let phase;
            let maturity;
            let harvestReady;

            if (widthCm < 6) {
                phase = "Masa Pertumbuhan";
                maturity = (widthCm / 6) * 50;
                harvestReady = false;
            } else if (widthCm < 9) {
                phase = "Mendekati Panen";
                maturity = 50 + ((widthCm - 6) / 3) * 50;
                harvestReady = false;
            } else {
                phase = "Siap Panen";
                maturity = 100;
                harvestReady = true;
            }

            resolve({
                mode: "leaf_width",
                leafWidthPixels: widthPx,
                leafWidthCm: Number(widthCm.toFixed(2)),
                leafHeightPixels: heightPx,
                maturity: Number(Math.max(0, Math.min(100, maturity)).toFixed(1)),
                phase,
                harvestReady,
                greenPixels: greenCount,
                imageWidth: width,
                imageHeight: height
            });
        };

        img.onerror = () => reject(new Error("Foto tidak dapat dibuka."));
        img.src = dataUrl;
    });
}

async function saveCNNHistory(result, imageData, source) {
    await loadCurrentSensor();

    const record = {
        timestamp: new Date().toISOString(),
        source,
        image: imageData,
        mode: result.mode,
        prediction: result.phase,
        phase: result.phase,
        confidence: null,
        analysisStatus: "Berhasil",
        leafWidthPixels: result.leafWidthPixels,
        leafWidthCm: result.leafWidthCm,
        leafHeightPixels: result.leafHeightPixels,
        maturity: result.maturity,
        harvestReady: result.harvestReady,
        greenPixels: result.greenPixels,
        temperature: latestSensorData.temperature,
        humidity: latestSensorData.humidity,
        soil: latestSensorData.soil
    };

    const response = await fetch(CNN_HISTORY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
    });

    if (!response.ok) {
        throw new Error("Gagal menyimpan hasil CNN ke Firebase (HTTP " + response.status + ").");
    }

    return record;
}

function renderAnalysis(result, imageData, source) {
    const box = el("cnnAnalysisResult");
    if (!box) return;

    box.innerHTML = `
        <div class="cnn-result-card">
            <img class="cnn-result-image" src="${imageData}" alt="Foto tanaman">
            <div>
                <div class="cnn-result-info">
                    <div class="cnn-result-item">
                        <span>Fase Pertumbuhan</span>
                        <strong>${escapeHTML(result.phase)}</strong>
                    </div>
                    <div class="cnn-result-item">
                        <span>Lebar Daun</span>
                        <strong>${result.leafWidthCm.toFixed(2)} cm</strong>
                    </div>
                    <div class="cnn-result-item">
                        <span>Kematangan</span>
                        <strong>${result.maturity.toFixed(1)}%</strong>
                    </div>
                    <div class="cnn-result-item">
                        <span>Status Panen</span>
                        <strong>${result.harvestReady ? "SIAP PANEN" : "BELUM SIAP"}</strong>
                    </div>
                    <div class="cnn-result-item">
                        <span>Sumber Foto</span>
                        <strong>${escapeHTML(source)}</strong>
                    </div>
                    <div class="cnn-result-item">
                        <span>Confidence ML</span>
                        <strong>--</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPhotoCard(record) {
    const grid = el("photoResultGrid");
    const empty = el("emptyPhoto");
    if (!grid) return;

    if (empty) empty.style.display = "none";

    const old = grid.querySelector(`[data-cnn-id="${CSS.escape(record._id || "")}"]`);
    if (old) old.remove();

    const card = document.createElement("div");
    card.className = "photo-card";
    card.dataset.cnnId = record._id || "";

    const timestamp = record.timestamp
        ? new Date(record.timestamp).toLocaleString("id-ID")
        : "--";

    card.innerHTML = `
        <div class="photo-card-image-wrap">
            <img src="${record.image || ""}" alt="Foto tanaman">
        </div>
        <div class="photo-info">
            <div class="photo-info-head">
                <strong>Hasil Analisis Tanaman</strong>
                <span>${timestamp}</span>
            </div>
            <div class="cnn-result-box">
                <span>FASE PERTUMBUHAN</span>
                <strong>${escapeHTML(record.phase || record.prediction || "--")}</strong>
                <small>Status: ${record.harvestReady ? "SIAP PANEN" : "BELUM SIAP"}</small>
            </div>
            <div class="photo-sensor-mini">
                <div><span>Lebar Daun</span><strong>${record.leafWidthCm ?? "--"} cm</strong></div>
                <div><span>Kematangan</span><strong>${record.maturity ?? "--"}%</strong></div>
            </div>
            <div class="photo-card-footer">
                <span class="cnn-card-status">Sumber: ${escapeHTML(record.source || "--")}</span>
            </div>
        </div>
    `;

    grid.prepend(card);
}

async function analyzeAndSave(dataUrl, source) {
    const resultBox = el("cnnAnalysisResult");
    if (resultBox) {
        resultBox.innerHTML = `<div class="empty-photo"><i class="fa-solid fa-spinner fa-spin"></i><p>Menganalisis foto...</p><span>Pengukuran dilakukan dari foto asli.</span></div>`;
    }

    try {
        const result = await analyzeLeafWidth(dataUrl);
        const compressed = await compressImage(dataUrl);

        renderAnalysis(result, compressed, source);
        const record = await saveCNNHistory(result, compressed, source);
        record._id = "local-" + Date.now();
        renderPhotoCard(record);

        if (el("cnnUploadResult")) {
            el("cnnUploadResult").style.display = "block";
            el("cnnUploadResult").textContent = "Hasil analisis berhasil disimpan ke Firebase.";
        }
    } catch (error) {
        console.error(error);
        if (resultBox) {
            resultBox.innerHTML = `<div class="empty-photo"><i class="fa-solid fa-triangle-exclamation"></i><p>Analisis gagal</p><span>${escapeHTML(error.message)}</span></div>`;
        }
    }
}

function initCamera() {
    const input = el("cameraIpInput");
    const connect = el("connectCameraButton");
    const capture = el("captureButton");
    const image = el("cameraImage");
    const placeholder = el("cameraPlaceholder");

    if (connect) {
        connect.addEventListener("click", () => {
            cameraIP = (input?.value || "").trim().replace(/\/+$/, "");

            if (!cameraIP) {
                setStatus("IP belum diisi", false);
                return;
            }

            image.src = cameraIP + "/capture?t=" + Date.now();
            image.style.display = "block";
            if (placeholder) placeholder.style.display = "none";
            setStatus("Kamera terhubung", true);
        });
    }

    if (capture) {
        capture.addEventListener("click", async () => {
            if (!cameraIP) {
                setStatus("Hubungkan kamera terlebih dahulu", false);
                return;
            }

            try {
                const response = await fetch(cameraIP + "/capture?t=" + Date.now(), {
                    cache: "no-store"
                });

                if (!response.ok) throw new Error("HTTP " + response.status);

                const blob = await response.blob();
                const reader = new FileReader();

                reader.onload = async () => {
                    await analyzeAndSave(reader.result, "ESP32-CAM");
                };

                reader.readAsDataURL(blob);
                setStatus("Foto berhasil diambil", true);
            } catch (error) {
                console.error(error);
                setStatus("Capture gagal / CORS ESP32-CAM", false);
                alert("ESP32-CAM tidak dapat dibaca browser. Pastikan IP benar dan endpoint /capture mengizinkan CORS.");
            }
        });
    }
}

function initUpload() {
    const input = el("cnnImageInput");
    const button = el("uploadCnnButton");

    if (!input || !button) return;

    button.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => analyzeAndSave(reader.result, "Upload Foto");
        reader.readAsDataURL(file);
    });
}

async function loadCNNHistory() {
    const grid = el("photoResultGrid");
    if (!grid) return;

    try {
        const response = await fetch(CNN_HISTORY_URL + "?t=" + Date.now(), {
            cache: "no-store"
        });
        if (!response.ok) return;

        const data = await response.json();
        if (!data) return;

        const rows = Object.entries(data)
            .map(([id, value]) => ({ _id: id, ...(value || {}) }))
            .filter(item => item.image)
            .sort((a,b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
            .slice(0, 6);

        const empty = el("emptyPhoto");
        if (!rows.length) {
            if (empty) empty.style.display = "flex";
            return;
        }

        if (empty) empty.style.display = "none";
        rows.forEach(renderPhotoCard);
    } catch (error) {
        console.error("Gagal mengambil riwayat CNN:", error);
    }
}

function setDate() {
    const target = el("currentDate");
    if (target) {
        target.textContent = new Date().toLocaleDateString("id-ID", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric"
        });
    }
}

setDate();
loadCurrentSensor();
initCamera();
initUpload();
loadCNNHistory();
