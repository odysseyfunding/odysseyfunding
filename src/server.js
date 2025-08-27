import express from express;
import path from path;
import { fileURLToPath } from url;
import morgan from morgan;
import helmet from helmet;
import compression from compression;
import dotenv from dotenv;

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set(view
