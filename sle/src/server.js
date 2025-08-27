import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import applyRoutes from './routes/apply.js';
import uploadRoutes from './routes/upload.js';
import microRoutes from './routes/micropages.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('pages/home', { title: 'SLE MVP' });
});

app.use(applyRoutes);
app.use(uploadRoutes);
app.use(microRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

const port = process.env.PORT || 3100;
app.listen(port, () => console.log(`Server running on :${port}`));
