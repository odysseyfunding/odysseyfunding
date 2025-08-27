import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import db from '../lib/db.js';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const token = req.params.token;
    const dir = path.join(uploadDir, token);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  }
});

const upload = multer({ storage });

router.get('/upload/:token', (req, res) => {
  const row = db.prepare('SELECT * FROM leads WHERE upload_token = ?').get(req.params.token);
  if (!row) return res.status(404).send('Invalid link');
  if (row.upload_token_expires_at && row.upload_token_expires_at < Date.now()) return res.status(410).send('Link expired');
  res.render('pages/upload', { title: 'Secure Upload', token: req.params.token });
});

router.post('/upload/:token', upload.array('statements', 3), (req, res) => {
  const token = req.params.token;
  const lead = db.prepare('SELECT * FROM leads WHERE upload_token = ?').get(token);
  if (!lead) return res.status(404).send('Invalid link');
  if (lead.upload_token_expires_at && lead.upload_token_expires_at < Date.now()) return res.status(410).send('Link expired');

  const insertUpload = db.prepare('INSERT INTO uploads (id, lead_id, filename, stored_path, created_at) VALUES (?, ?, ?, ?, ?)');
  const now = Date.now();
  for (const f of req.files || []) {
    insertUpload.run(`${now}-${f.filename}`, lead.id, f.originalname, f.path, now);
  }

  db.prepare('UPDATE leads SET docs_received_at = ?, updated_at = ? WHERE id = ?').run(now, now, lead.id);
  res.render('pages/thankyou', { title: 'Uploaded', link: null });
});

export default router;
