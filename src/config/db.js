import mongoose from 'mongoose';
import config from './env.js';

/**
 * Establish a connection to the local MongoDB database.
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Failed: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
