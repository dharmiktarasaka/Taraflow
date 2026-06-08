import mongoose from 'mongoose';
import logger from '../utils/logger.util.js';
import dns from 'dns';

export const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI;
    if (!connStr) {
      throw new Error('MONGODB_URI environment variable is missing');
    }

    // Set public DNS resolvers (Google DNS) for SRV records resolution to work around Node/C-Ares DNS issues on Windows
    if (connStr.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '8.8.4.4']);
        logger.info('Configured Google DNS (8.8.8.8, 8.8.4.4) for MongoDB SRV resolution');
      } catch (dnsErr) {
        logger.warn(`Unable to set custom DNS servers: ${dnsErr.message}`);
      }
    }

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    await mongoose.connect(connStr);
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
