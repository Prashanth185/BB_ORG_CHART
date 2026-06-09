import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const photosDir = path.join(__dirname, '../uploads/photos');

if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `emp-${req.params.id}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();

router.post('/employees/:id/photo', authenticateToken, upload.single('photo'), (req, res) => {
  try {
    const empId = req.params.id;
    const existing = db.prepare('SELECT id, photo_url FROM employees WHERE id = ?').get(empId);
    if (!existing) return res.status(404).json({ error: 'Employee not found' });
    if (!req.file) return res.status(400).json({ error: 'No photo file uploaded' });

    const photoUrl = `/uploads/photos/${req.file.filename}`;

    if (existing.photo_url) {
      const oldPath = path.join(__dirname, '..', existing.photo_url.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    db.prepare(`
      UPDATE employees SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(photoUrl, empId);

    res.json({ message: 'Photo uploaded', photo_url: photoUrl });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
