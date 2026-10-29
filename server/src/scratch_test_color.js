import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { Channel } from './models/Channel.js';

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const channels = await Channel.find({}).lean();
  for (const ch of channels) {
    console.log('Channel:', ch.name, ch._id);
    console.log('Branding logo:', ch.branding?.logo);
  }
  await mongoose.disconnect();
}

check().catch(console.error);
