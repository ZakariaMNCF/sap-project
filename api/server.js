require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

app.use(cors({
  origin: '*', // Allow all origins for now (you can restrict it later)
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary Multer Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'sap-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx', 'mp4'],
    resource_type: 'auto'
  }
});

const upload = multer({ storage });

// Upload Route
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  res.json({
    success: true,
    filename: req.file.originalname,
    url: req.file.path,
    public_id: req.file.filename
  });
});

// List Files Route
app.get('/api/files', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({ prefix: 'sap-uploads/', type: 'upload' });

    const files = result.resources.map(file => ({
      name: file.original_filename,
      url: file.secure_url,
      public_id: file.public_id
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete File
app.delete('/api/delete/:public_id', async (req, res) => {
  try {
    const result = await cloudinary.uploader.destroy(req.params.public_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
