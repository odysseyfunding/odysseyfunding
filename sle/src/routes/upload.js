import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import db from '../lib/db.js';
import { computeSleScore } from '../lib/sleScore.js';

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
  // Recompute SLE with docs flag and show offer range
  const { raw, norm } = computeSleScore({
    depositsBand: lead.deposits_band,
    timeInBiz: lead.time_in_biz,
    state: lead.state,
    industry: lead.industry,
    partnerId: lead.partner_id,
    docsReceived: true
  });
  const status = norm >= 7 ? 'QUALIFIED' : 'DISQUALIFIED';
  // Dumb offer curve: 1-6x monthly deposits proxy
  const bandMult = { '<25k': [0.5, 1.5], '25-50k': [1, 2.5], '50-100k': [1.5, 3.5], '>100k': [2, 4.5] }[lead.deposits_band] || [1,2];
  const monthly = { '<25k': 20000, '25-50k': 35000, '50-100k': 75000, '>100k': 125000 }[lead.deposits_band] || 30000;
  const offerMin = Math.round(monthly * bandMult[0]);
  const offerMax = Math.round(monthly * bandMult[1]);
  db.prepare('UPDATE leads SET sle_raw = ?, sle_norm = ?, status = ?, offer_min = ?, offer_max = ? WHERE id = ?')
    .run(raw, norm, status, offerMin, offerMax, lead.id);

  res.render('pages/offer', { title: 'Offer Range', offerMin, offerMax });
});

export default router;
