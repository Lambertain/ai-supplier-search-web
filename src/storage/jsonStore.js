import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function ensureFile(filePath, defaultValue) {
  try {
    await fs.access(filePath);
  } catch (err) {
    await ensureDir();
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

export async function readJson(fileName, defaultValue) {
  const filePath = path.join(DATA_DIR, fileName);
  await ensureFile(filePath, defaultValue);
  const data = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to parse JSON from ${filePath}:`, error.message);
    throw error;
  }
}

export async function writeJson(fileName, value) {
  const filePath = path.join(DATA_DIR, fileName);
  await ensureDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return value;
}

export async function updateJson(fileName, updater, defaultValue) {
  const current = await readJson(fileName, defaultValue);
  const nextValue = await updater(current);
  return writeJson(fileName, nextValue);
}
