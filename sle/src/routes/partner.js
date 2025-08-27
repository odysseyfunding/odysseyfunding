import { Router } from 'express';

const router = Router();

router.get('/widget.js', (req, res) => {
  const partnerId = req.query.partner || 'partner';
  const publicUrl = process.env.PUBLIC_URL || '';
  const applyUrl = `${publicUrl}/apply?partner=${encodeURIComponent(partnerId)}`;
  const js = `(() => {
    const btn = document.createElement('button');
    btn.textContent = 'Financing Available';
    btn.style.cssText = 'all:unset;display:inline-block;background:#2c7be5;color:#fff;padding:10px 14px;border-radius:8px;cursor:pointer;font-family:system-ui,Segoe UI,Roboto,sans-serif;';
    btn.addEventListener('click', () => { window.open('${applyUrl}', '_blank'); });
    (document.currentScript && document.currentScript.parentNode || document.body).appendChild(btn);
  })();`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(js);
});

router.get('/partner/snippet', (req, res) => {
  const host = process.env.PUBLIC_URL || '';
  const example = `<script src="${host}/widget.js?partner=CPA123"></script>`;
  res.render('pages/partner_snippet', { title: 'Partner Widget', example });
});

export default router;
