import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import dayjs from 'dayjs';
import db from '../lib/db.js';
import { sendSms } from '../lib/sms.js';
import { computeSleScore } from '../lib/sleScore.js';

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);
const router = Router();

router.get('/apply', (req, res) => {
  const partnerId = req.query.partner || '';
  res.render('pages/apply', { title: 'Apply', partnerId });
});

router.post('/apply', async (req, res) => {
  const now = dayjs();
  const id = nano();
  const uploadToken = nano();
  const uploadExpires = now.add(72, 'hour');
  const partnerId = req.query.partner || req.body.partner_id || null;
  const consent = req.body.tcp_consent === 'on' || req.body.tcp_consent === '1' ? 1 : 0;

  const insert = db.prepare(`INSERT INTO leads (
    id, created_at, updated_at, business_name, owner_name, phone, email, state, industry,
    deposits_band, time_in_biz, tcp_consent, partner_id, upload_token, upload_token_expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  insert.run(
    id,
    now.valueOf(),
    now.valueOf(),
    req.body.business_name,
    req.body.owner_name,
    req.body.phone,
    req.body.email,
    req.body.state,
    req.body.industry,
    req.body.deposits_band,
    req.body.time_in_biz,
    consent,
    partnerId,
    uploadToken,
    uploadExpires.valueOf()
  );

  // Compute SLE and gate
  const { raw, norm } = computeSleScore({
    depositsBand: req.body.deposits_band,
    timeInBiz: req.body.time_in_biz,
    state: req.body.state,
    industry: req.body.industry,
    partnerId,
    docsReceived: false
  });
  const status = norm >= 7 ? 'QUALIFIED' : 'DISQUALIFIED';
  db.prepare('UPDATE leads SET sle_raw = ?, sle_norm = ?, status = ? WHERE id = ?').run(raw, norm, status, id);

  const link = `${process.env.PUBLIC_URL || ''}/upload/${uploadToken}`.replace(/\/$/, '');
  const smsBody = `Got it—ready for a same-day offer? Upload 3 bank statements: ${link} (expires in 72h). Reply STOP to opt out.`;
  try { await sendSms({ to: req.body.phone, body: smsBody }); } catch (e) { console.error('SMS error', e.message); }

  res.render('pages/thankyou', { title: 'Thank you', link });
});

export default router;
