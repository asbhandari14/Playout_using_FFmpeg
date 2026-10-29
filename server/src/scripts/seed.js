import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { User } from '../models/User.js';
import { Server } from '../models/Server.js';
import { Channel } from '../models/Channel.js';
import { Playlist } from '../models/Playlist.js';
import { ROLES, CHANNEL_STATUS } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cloud_playout';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB');

    // 1. Super Admin
    const superAdminEmail = 'superadmin@playout.com';
    let superAdmin = await User.findOne({ email: superAdminEmail });
    if (!superAdmin) {
      const passwordHash = await User.hashPassword('Password@123');
      superAdmin = await User.create({
        name: 'Chief Broadcast Director',
        email: superAdminEmail,
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        createdBy: null,
        isActive: true
      });
      console.log(`[Seed] Super Admin created: ${superAdminEmail} / Password@123`);
    } else {
      console.log(`[Seed] Super Admin already exists: ${superAdminEmail}`);
    }

    // 2. Admin
    const adminEmail = 'admin@playout.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const passwordHash = await User.hashPassword('Password@123');
      admin = await User.create({
        name: 'Broadcast Operations Admin',
        email: adminEmail,
        passwordHash,
        role: ROLES.ADMIN,
        createdBy: superAdmin._id,
        isActive: true
      });
      console.log(`[Seed] Admin created: ${adminEmail} / Password@123`);
    }

    // 3. Channel Operator (User)
    const operatorEmail = 'operator@playout.com';
    let operator = await User.findOne({ email: operatorEmail });
    if (!operator) {
      const passwordHash = await User.hashPassword('Password@123');
      operator = await User.create({
        name: 'Live Deck Operator',
        email: operatorEmail,
        passwordHash,
        role: ROLES.USER,
        createdBy: admin._id,
        isActive: true
      });
      console.log(`[Seed] Operator User created: ${operatorEmail} / Password@123`);
    }

    // 4. Default Flussonic Server
    let defaultServer = await Server.findOne({ name: 'Flussonic Main Edge' });
    if (!defaultServer) {
      defaultServer = new Server({
        name: 'Flussonic Main Edge',
        category: 'Flussonic Media',
        streamUrl: 'http://94.136.185.222:81',
        serverUsername: 'flussonic_admin',
        rtmpBaseUrl: 'rtmp://94.136.185.222/static',
        hlsBaseUrl: 'http://94.136.185.222:81',
        createdBy: superAdmin._id
      });
      defaultServer.setPassword('flussonic_secret_pass');
      await defaultServer.save();
      console.log(`[Seed] Default Flussonic Server created`);
    } else if (!defaultServer.streamUrl) {
      defaultServer.streamUrl = 'http://94.136.185.222:81';
      defaultServer.rtmpBaseUrl = 'rtmp://94.136.185.222/static';
      defaultServer.hlsBaseUrl = 'http://94.136.185.222:81';
      await defaultServer.save();
    }

    // 5. Default Channel: SAI LEELA (as shown in reference screenshot!)
    let defaultChannel = await Channel.findOne({ name: 'SAI LEELA' });
    if (!defaultChannel) {
      defaultChannel = await Channel.create({
        name: 'SAI LEELA',
        server: defaultServer._id,
        assignedUser: operator._id,
        streamKey: 'saileela',
        hlsUrl: 'http://94.136.185.222:81/saileela/index.m3u8',
        rtmpUrl: 'rtmp://94.136.185.222/static/saileela',
        status: CHANNEL_STATUS.IDLE,
        outputSettings: {
          resolution: '1280x720',
          width: 1280,
          height: 720,
          fps: 25,
          videoBitrate: '2500k',
          audioBitrate: '128k'
        },

        branding: {
          logo: {
            assetPath: '',
            enabled: false,
            position: 'top-right',
            sizePercent: 20,
            marginX: 2,
            marginY: 2
          },
          ticker: {
            enabled: false,
            text: 'Shree Sai Bhakti Dhara - Live Broadcast Playout Stream',
            bgColor: '#000000dd',
            textColor: '#ffffff',
            fontFamily: 'Sans Bold',
            fontSize: 24,
            width: 100,
            paddingY: 12,
            marginBottom: 4,
            alignment: 'center',
            speed: 3
          }
        },
        createdBy: superAdmin._id
      });

      await Playlist.create({
        channel: defaultChannel._id,
        items: [],
        createdBy: superAdmin._id
      });

      console.log(`[Seed] Default Channel 'SAI LEELA' created and assigned to operator`);
    }

    console.log('[Seed] Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  }
};

seedDatabase();
