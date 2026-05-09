# ShapeFixer 🌍⚡

**Official Site:** [shapefixer.princesite.in](https://shapefixer.princesite.in)

**The Professional GIS Data Repair & Engineering Engine.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sutharprin098/ShapeFixer&root-directory=frontend)

ShapeFixer is a high-performance web utility built for GIS professionals who need a reliable, automated way to clean spatial data. No heavy software, no complex installs—just upload, fix, and download.

---

## 🚀 Quick Deployment (Vercel)

To deploy this project to **Vercel**:

1. Click the button above or go to [Vercel Dashboard](https://vercel.com/new).
2. Import your **ShapeFixer** repository.
3. **IMPORTANT:** In the "Project Settings", set the **Root Directory** to `frontend`.
4. Click **Deploy**.

---

## ✨ Features

- **📦 Batch Processing**: Upload multiple files simultaneously and track progress in a real-time dashboard.
- **🔄 Undo/Redo System**: Full state-history tracking in the attribute editor. Revert any change instantly.
- **🛠️ Self-Healing Geometry**: Automated fixes for self-intersections, ring orientation, and unclosed rings.
- **🏗️ Structure Recovery**: Automatically reconstructs missing `.shx` or `.dbf` files from base geometry.
- **🗺️ Interactive Preview**: Instant MapLibre GL visualization with multi-layer support.
- **📊 Attribute Manager**: Full CRUD operations on your spatial data attributes directly in-browser.
- **🌐 CRS Normalization**: Automatic projection detection and seamless re-projection to EPSG:4326.

---

## 📂 Project Structure

```text
shapefixer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py      # REST API route definitions
│   │   ├── services/
│   │   │   ├── validator.py      # GIS Audit & Error detection
│   │   │   └── repairer.py       # Geometric healing engine
│   │   ├── utils/
│   │   │   └── file_manager.py   # Secure file/ZIP operations
│   │   └── main.py               # FastAPI entry & background tasks
│   ├── temp_storage/             # Temporary processing workspace
│   ├── tests/                    # Backend unit & integration tests
│   └── requirements.txt          # Python engine dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # SEO & Global design wrapper
│   │   │   ├── page.tsx          # Main dashboard logic
│   │   │   └── globals.css       # Design system & glassmorphism
│   │   ├── components/
│   │   │   ├── AttributeTable.tsx # Editor with Undo/Redo
│   │   │   ├── BatchDashboard.tsx # Multi-task monitor
│   │   │   ├── MapPreview.tsx     # High-speed spatial viewer
│   │   │   ├── UploadZone.tsx     # Parallel multi-uploader
│   │   │   ├── IssueCard.tsx      # Error reporting UI
│   │   │   ├── Navbar.tsx         # Header & Navigation
│   │   │   └── Footer.tsx         # Site footer
│   │   └── lib/                  # Frontend helper utilities
│   ├── public/
│   │   └── logo.png              # Custom branding asset
│   └── package.json              # UI dependencies & scripts
├── README.md                     # Documentation
└── package.json                  # Root monorepo configuration
```

### 🛠️ Backend Deep Dive
- **`main.py`**: Handles server startup, CORS policy, and the hourly scheduled cleanup of temporary files.
- **`endpoints.py`**: Defines the POST routes for `/upload`, `/validate`, and `/repair`.
- **`validator.py`**: Scans files for structural health and checks OGC geometry compliance.
- **`repairer.py`**: Uses Shapely's `make_valid` and custom algorithms to fix corrupt data.
- **`file_manager.py`**: Manages unique UUID-based directories and packages final repairs into ZIPs.

### 💻 Frontend Deep Dive
- **`page.tsx`**: The core state machine. It manages transitions between upload, batch monitoring, and file inspection.
- **`BatchDashboard.tsx`**: Uses Framer Motion for smooth animations and provides a centralized view for all tasks.
- **`AttributeTable.tsx`**: Implements a custom history stack for **Undo/Redo** and handles in-browser GIS data editing.
- **`MapPreview.tsx`**: Integrates MapLibre GL to render repaired GeoJSON data with automatic bounds fitting.

---

## 🚀 Installation & Setup

### 1. Backend (API)
Requires Python 3.11+
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app/main.py
```

### 2. Frontend (Dashboard)
Requires Node.js 20+
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 License

MIT License. Open source and free for commercial or private use.

---

**ShapeFixer** — *GIS workflows made simple.*
