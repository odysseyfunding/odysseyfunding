import { Router } from 'express';

const router = Router();

const states = [
  'CA','TX','FL','NY','IL','PA','OH','GA','NC','MI',
  'NJ','VA','WA','AZ','MA','TN','IN','MO','MD','WI'
];

router.get('/denied/:state', (req, res) => {
  const state = (req.params.state || '').toUpperCase();
  if (!states.includes(state)) return res.status(404).send('Not found');
  const provider = 'Provider';
  res.render('pages/denied', { title: `Denied by ${provider} in ${state}?`, state, provider });
});

router.get('/denied/:state/:provider', (req, res) => {
  const state = (req.params.state || '').toUpperCase();
  if (!states.includes(state)) return res.status(404).send('Not found');
  const provider = req.params.provider || 'Provider';
  res.render('pages/denied', { title: `Denied by ${provider} in ${state}?`, state, provider });
});

export default router;
