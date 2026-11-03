"""
SMART FARMING - CNN API
------------------------
Local API untuk menerima foto dari monitoring.html,
menjalankan model CNN, dan mengembalikan hasil klasifikasi.

Letakkan:
    cnn_model.keras
    class_names.json

di folder yang sama dengan file ini.

Jalankan:
    pip install -r requirements-cnn.txt
    python cnn_api.py

Endpoint:
    POST /predict
    field: image

Response:
{
    "prediction": "siap_panen",
    "confidence": 0.94,
    "leafWidthCm": 9.2,
    "leafAreaRatio": 38.4,
    "maturity": null,
    "measurements": {...}
}
"""

from pathlib import Path
import json
import io

import numpy as np
from PIL import Image
from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    import tensorflow as tf
except Exception as exc:
    raise RuntimeError(
        "TensorFlow belum terpasang. Jalankan: pip install -r requirements-cnn.txt"
    ) from exc

try:
    import cv2
except Exception as exc:
    raise RuntimeError(
        "OpenCV belum terpasang. Jalankan: pip install -r requirements-cnn.txt"
    ) from exc


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "cnn_model.keras"
LABEL_PATH = BASE_DIR / "class_names.json"

PX_PER_CM = 40.0

DEFAULT_CLASSES = [
    "masa_pertumbuhan",
    "mendekati_panen",
    "siap_panen",
]

app = Flask(__name__)
CORS(app)


def load_classes():
    if LABEL_PATH.exists():
        with open(LABEL_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, list) and data:
            return data

        if isinstance(data, dict) and "classes" in data:
            return data["classes"]

    return DEFAULT_CLASSES


if not MODEL_PATH.exists():
    MODEL = None
    CLASS_NAMES = load_classes()
else:
    MODEL = tf.keras.models.load_model(MODEL_PATH)
    CLASS_NAMES = load_classes()


def prepare_image(file_bytes):
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")

    # Ambil ukuran model jika tersedia.
    shape = MODEL.input_shape

    if isinstance(shape, list):
        shape = shape[0]

    target_h = int(shape[1]) if shape[1] else 224
    target_w = int(shape[2]) if shape[2] else 224

    image = image.resize(
        (target_w, target_h),
        Image.Resampling.LANCZOS
    )

    array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(array, axis=0)


def calculate_leaf_measurements(file_bytes):
    """
    Pengukuran sederhana berbasis segmentasi warna hijau.
    Ini bukan pengganti pipeline pengukuran penelitian jika
    penelitianmu memiliki rumus segmentasi khusus.
    """
    array = np.frombuffer(file_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(array, cv2.IMREAD_COLOR)

    if bgr is None:
        return {
            "leafWidthCm": None,
            "leafAreaRatio": None,
            "measurements": {}
        }

    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    # Rentang hijau yang cukup umum untuk daun.
    lower = np.array([25, 35, 25], dtype=np.uint8)
    upper = np.array([100, 255, 255], dtype=np.uint8)

    mask = cv2.inRange(hsv, lower, upper)

    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel
    )
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel
    )

    area_pixels = int(np.count_nonzero(mask))
    total_pixels = int(mask.shape[0] * mask.shape[1])

    area_ratio = (
        area_pixels / total_pixels * 100
        if total_pixels
        else None
    )

    ys, xs = np.where(mask > 0)

    if len(xs) == 0:
        return {
            "leafWidthCm": None,
            "leafAreaRatio": area_ratio,
            "measurements": {
                "leaf_area_pixels": area_pixels
            }
        }

    width_pixels = int(xs.max() - xs.min() + 1)
    width_cm = width_pixels / PX_PER_CM

    height_pixels = int(ys.max() - ys.min() + 1)
    height_cm = height_pixels / PX_PER_CM

    return {
        "leafWidthCm": round(width_cm, 2),
        "leafAreaRatio": round(area_ratio, 2),
        "measurements": {
            "leaf_area_pixels": area_pixels,
            "leaf_width_pixels": width_pixels,
            "leaf_height_pixels": height_pixels,
            "leaf_height_cm": round(height_cm, 2),
            "px_per_cm": PX_PER_CM
        }
    }


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": MODEL is not None,
        "classes": CLASS_NAMES
    })


@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify({
            "error": "Field 'image' tidak ditemukan."
        }), 400

    if MODEL is None:
        return jsonify({
            "error": "cnn_model.keras belum tersedia."
        }), 503

    file = request.files["image"]

    if not file.filename:
        return jsonify({
            "error": "File gambar kosong."
        }), 400

    file_bytes = file.read()

    try:
        batch = prepare_image(file_bytes)
        prediction = MODEL.predict(batch, verbose=0)[0]

        index = int(np.argmax(prediction))
        confidence = float(prediction[index])

        measurements = calculate_leaf_measurements(
            file_bytes
        )

        return jsonify({
            "prediction": CLASS_NAMES[index]
                if index < len(CLASS_NAMES)
                else str(index),
            "confidence": confidence,
            "leafWidthCm": measurements["leafWidthCm"],
            "leafAreaRatio": measurements["leafAreaRatio"],
            "maturity": None,
            "measurements": measurements["measurements"]
        })

    except Exception as exc:
        return jsonify({
            "error": str(exc)
        }), 500


if __name__ == "__main__":
    print("==============================================")
    print(" SMART FARMING - CNN API")
    print("==============================================")
    print("Model :", MODEL_PATH)
    print("Loaded:", MODEL is not None)
    print("Classes:", CLASS_NAMES)
    print("Endpoint: http://127.0.0.1:5000/predict")
    print("==============================================")

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
