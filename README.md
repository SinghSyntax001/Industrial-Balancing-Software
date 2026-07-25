
# ⚙️ Industrial Balancing Software

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python / Tech Stack](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)](#)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> An end-to-end industrial software solution for dynamic rotor balancing, vibration analysis, and mass correction calculations across single-plane and two-plane rotating machinery.

---

## 📌 Overview

Unbalance in rotating machinery is one of the primary causes of mechanical wear, structural fatigue, and industrial downtime. **Industrial Balancing Software** provides precision calculation algorithms and real-time visualization to quantify amplitude and phase angle discrepancies, aiding engineers in dynamic balancing operations to comply with **ISO 1940-1** quality standards.

---

## ✨ Key Features

- **Single-Plane & Two-Plane Static/Dynamic Balancing:**
  - Influence coefficient method for accurate trial-mass vector analysis.
  - Phase-angle and displacement amplitude calculation.
- **Mass Correction Options:**
  - Addition (adding balance weights) or removal (drilling/milling out weight).
  - Fixed-location splitting (e.g., splitting correction weight across discrete fan blades or bolt holes).
- **ISO 1940 Quality Grade Assessment:**
  - Automated comparison against standard balance quality grades ($G0.4, G1.0, G2.5, G6.3, G16$).
- **Polar & Vector Diagnostics:**
  - Interactive graphical visualizer for original unbalance, trial runs, and residual vector plots.
- **Report Generation:**
  - Export comprehensive inspection and compliance reports in PDF/JSON formats.

---

## 🛠️ Architecture & Tech Stack

- **Frontend / UI:** PyQt6 / Web UI (HTML5, Tailwind CSS, JavaScript)
- **Backend / Calculation Engine:** Python 3.10+ (NumPy, SciPy, FastAPI)
- **Data Visualization:** Matplotlib / Chart.js
- **Exporting:** ReportLab / Jinja2 PDF Renderer

---

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed on your local system:
- **Python:** `3.10` or higher
- **Git**

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/SinghSyntax001/Industrial-Balancing-Software.git](https://github.com/SinghSyntax001/Industrial-Balancing-Software.git)
   cd Industrial-Balancing-Software
  '''
2. **Create and activate a virtual environment:**
```bash
# On Linux/macOS
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
.\venv\Scripts\activate

```


3. **Install dependencies:**
```bash
pip install -r requirements.txt

```


4. **Launch the Application:**
```bash
python main.py

```



---

## 📐 Dynamic Balancing Formula Reference

The core solver uses the **Influence Coefficient Method**:

$$[O] + [A] \cdot [W_{trial}] = [O_{trial}]$$

Where:

* $[O]$ = Initial unbalance vibration vector $(\text{Amplitude} \angle \theta)$
* $[W_{trial}]$ = Known trial weight vector $(\text{Mass} \angle \phi)$
* $[O_{trial}]$ = Measured vibration vector during trial run
* $[A]$ = Influence coefficient calculated via:

$$[A] = \frac{[O_{trial}] - [O]}{[W_{trial}]}$$

The required correction weight $[W_{correction}]$ to cancel out initial unbalance is:

$$[W_{correction}] = -\frac{[O]}{[A]}$$

---





## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details.

---

## 👤 Author

* **SinghSyntax001** - *[GitHub Profile](https://www.google.com/search?q=https://github.com/SinghSyntax001)*

```

***

### 💡 Customization Tips
If your software uses specific frameworks or has a slightly different focus (e.g., assembly line load balancing vs. dynamic mechanical rotor balancing), you can tweak:
1. **Tech Stack**: Update the frameworks listed under **Architecture & Tech Stack**.
2. **Main file**: Update `python main.py` or the start command to match your project's startup command (e.g., `npm start`, `uvicorn app.main:app --reload`, etc.).

```
