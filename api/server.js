require('dotenv').config();
const express = require('express');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const upload = multer({ storage });

// CORS Configuration
const allowedOrigins = [
  'https://zakariamncf.github.io/sap-project',
  'https://sap-project-nine.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Static Files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    res.json({
      success: true,
      filename: req.file.originalname,
      url: req.file.path,
      public_id: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'sap-uploads/'
    });
    
    res.json({ 
      files: result.resources.map(file => ({
        name: file.original_filename || file.public_id,
        url: file.secure_url,
        public_id: file.public_id,
        type: file.resource_type
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/delete/:public_id', async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.params.public_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Frontend Routes
app.get('/SAP-Customer', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/SAP-Customer.html'));
});

// Error Handling
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// Server Start
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;