// api/server.js
require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');
const helmet  = require('helmet');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer  = require('multer');

const app = express();

// ─── 1. MIDDLEWARE GÉNÉRAL ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// ─── 2. CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS: origin ${origin} non autorisée`));
  },
  methods: ['GET','POST','DELETE'],
  credentials: true
}));

// ─── 3. CONFIGURER CLOUDINARY + MULTER ─────────────────────────────────────────
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10 Mo
});

// ─── 4. ROUTES API ───────────────────────────────────────────────────────────────

// 4.1 Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  res.json({
    success:   true,
    filename:  req.file.originalname,
    url:       req.file.path,
    public_id: req.file.filename
  });
});

// 4.2 Lister
app.get('/api/files', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type:   'upload',
      prefix: 'sap-uploads/'
    });
    const files = result.resources.map(f => ({
      name:      f.original_filename || f.public_id,
      url:       f.secure_url,
      public_id: f.public_id,
      type:      f.resource_type,
      size:      f.bytes       // taille en octets
    }));
    res.json(files);
  } catch (err) {
    console.error('Erreur Cloudinary list:', err);
    res.status(500).json({ error: 'Impossible de récupérer la liste des fichiers' });
  }
});

// 4.3 Supprimer
app.delete('/api/delete/:public_id', async (req, res) => {
  try {
    const result = await cloudinary.uploader.destroy(req.params.public_id);
    if (result.result === 'not found') {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur Cloudinary delete:', err);
    res.status(500).json({ error: 'Impossible de supprimer le fichier' });
  }
});

// ─── 5. ROUTES POUR VOTRE FRONTEND HTML ─────────────────────────────────────────

// Page d’accueil et page client
app.get(['/', '/SAP-Customer'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/SAP-Customer.html'));
});

// ─── 6. ASSETS STATIQUES ─────────────────────────────────────────────────────────
// On sert tout ce qui est CSS/JS/fonts/images sous /static/*
// Vous devrez adapter vos liens HTML : 
//    <link href="/static/all.min.css">, <script src="/static/axios.min.js">, etc.
app.use(
  '/static',
  express.static(path.join(__dirname, '../public'))
);

// ─── 7. 404 & ERREUR GLOBALE ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

// ─── 8. LANCEMENT DU SERVEUR ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`Server en écoute sur le port ${PORT}`)
  );
}

module.exports = app;
