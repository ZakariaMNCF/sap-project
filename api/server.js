require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// CORS Configuration
const allowedOrigins = [
  'https://github.com/ZakariaMNCF/sap-project',
  'https://sap-project-production.up.railway.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Multer Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sap-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'mov'],
    resource_type: 'auto'
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});

// Static Files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    success: true,
    filename: req.file.originalname,
    url: req.file.path,
    public_id: req.file.filename
  });
});

app.get('/api/files', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'sap-uploads/'
    });

    const files = result.resources.map(file => ({
      name: file.original_filename || file.public_id,
      url: file.secure_url,
      public_id: file.public_id,
      type: file.resource_type
    }));

    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/delete/:public_id', async (req, res) => {
  try {
    const result = await cloudinary.uploader.destroy(req.params.public_id);
    if (result.result === 'not found') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Frontend HTML Route
app.get('/SAP-Customer', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/SAP-Customer.html'));
});

// 404 Route
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
