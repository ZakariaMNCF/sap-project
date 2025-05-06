// api/server.js
require('dotenv').config();                 // 1️⃣ Load .env
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();

// ─── 2. MIDDLEWARE ──────────────────────────────────────────────────────────────

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Secure HTTP headers
app.use(helmet());

// ─── 3. CORS CONFIGURATION ──────────────────────────────────────────────────────
// Read ALLOWED_ORIGINS from .env, split by commas, trim whitespace, ignore empties
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length);

app.use(cors({
  origin: (origin, callback) => {
    // allow non-CORS requests (like from Postman) with no origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// ─── 4. CLOUDINARY + MULTER SETUP ────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'sap-uploads',
    allowed_formats: ['jpg','jpeg','png','gif','pdf','doc','docx','xls','xlsx','mp4','mov'],
    resource_type:   'auto'
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }  // 10 MB max
});

// ─── 5. SERVE STATIC FILES ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// Automatically serve your customer page at “/” and at “/SAP-Customer”
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/SAP-Customer.html'));
});
app.get('/SAP-Customer', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/SAP-Customer.html'));
});

// ─── 6. API ENDPOINTS ────────────────────────────────────────────────────────────

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu' });
  }
  res.json({
    success:   true,
    filename:  req.file.originalname,
    url:       req.file.path,
    public_id: req.file.filename
  });
});

// List files endpoint
app.get('/api/files', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type:   'upload',
      prefix: 'sap-uploads/'
    });

    // Map Cloudinary data to a simpler format
    const files = result.resources.map(f => ({
      name:      f.original_filename || f.public_id,
      url:       f.secure_url,
      public_id: f.public_id,
      type:      f.resource_type
    }));

    res.json(files);
  } catch (err) {
    console.error('Error fetching from Cloudinary:', err);
    res.status(500).json({ error: 'Impossible de récupérer la liste des fichiers' });
  }
});

// Delete file endpoint
app.delete('/api/delete/:public_id', async (req, res) => {
  try {
    const result = await cloudinary.uploader.destroy(req.params.public_id);
    if (result.result === 'not found') {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting from Cloudinary:', err);
    res.status(500).json({ error: 'Impossible de supprimer le fichier' });
  }
});

// ─── 7. 404 + GLOBAL ERROR HANDLERS ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ─── 8. START THE SERVER ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`🟢 Server running on http://localhost:${PORT}`));
}

module.exports = app;
