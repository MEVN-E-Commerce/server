import app from './app.js';
import connectDB from './config/db.js';
import config from './config/env.js';

// Initialize MongoDB Connection
connectDB();

// Start HTTP Server
const PORT = config.PORT;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
});

// Graceful handle for unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Promise Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});
