const DATABASE_URL =
    "https://selada-a9428-default-rtdb.asia-southeast1.firebasedatabase.app";

const button = document.getElementById("testButton");
const result = document.getElementById("result");

async function testFirebase() {
    button.disabled = true;
    button.textContent = "MENGUJI...";
    result.className = "result";
    result.textContent = "Menghubungkan ke Firebase...";

    try {
        const response = await fetch(DATABASE_URL + "/.json", {
            method: "GET",
            cache: "no-store"
        });

        const text = await response.text();

        if (!response.ok) {
            throw new Error(
                "HTTP " + response.status + "\n" + text
            );
        }

        let data;

        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        result.className = "result success";

        if (data === null) {
            result.textContent =
                "✅ Koneksi Firebase BERHASIL.\n\n" +
                "Database dapat diakses, tetapi root database masih kosong.";
        } else {
            const keys =
                typeof data === "object"
                    ? Object.keys(data)
                    : [];

            result.textContent =
                "✅ Koneksi Firebase BERHASIL!\n\n" +
                "HTTP Status: " + response.status + "\n" +
                "Data ditemukan.\n" +
                "Jumlah key root: " + keys.length + "\n\n" +
                "Contoh struktur data:\n" +
                JSON.stringify(data, null, 2).slice(0, 5000);
        }

    } catch (error) {
        result.className = "result error";

        result.textContent =
            "❌ Koneksi Firebase GAGAL.\n\n" +
            "Pesan:\n" + error.message +
            "\n\nKemungkinan penyebab:\n" +
            "1. Firebase Realtime Database Rules menolak pembacaan.\n" +
            "2. URL database tidak sesuai.\n" +
            "3. Browser memblokir request.\n" +
            "4. Internet tidak tersedia.";
    }

    button.disabled = false;
    button.textContent = "TEST KONEKSI FIREBASE";
}

button.addEventListener("click", testFirebase);
