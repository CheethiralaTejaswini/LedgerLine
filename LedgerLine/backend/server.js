const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` LedgerLine Financial Core Server Running`);
      console.log(` Port:    http://localhost:${PORT}`);
      console.log(` Env:     ${process.env.NODE_ENV || 'development'}`);
      console.log(`====================================================`);
    });

    const shutdown = async signal => {
      console.log(`\n[LedgerLine] Received ${signal}. Gracefully shutting down...`);
      server.close(() => {
        console.log('[LedgerLine] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[LedgerLine Server Startup Error]:', error.message);
    process.exit(1);
  }
}

startServer();

