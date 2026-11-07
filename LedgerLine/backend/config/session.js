const session = require('express-session');
const MongoStore = require('connect-mongo');

function createSessionConfig() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/ledgerline';
  const sessionSecret = process.env.SESSION_SECRET || 'ledgerline_super_secret_session_key_2026';
  const isProduction = process.env.NODE_ENV === 'production';

  const storeOptions = {
    mongoUrl,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native',
    touchAfter: 24 * 3600 // lazy session updates
  };

  let store;
  try {
    store = MongoStore.create(storeOptions);
  } catch (err) {
    console.warn('[LedgerLine Session] Falling back to MemoryStore:', err.message);
  }

  return session({
    store,
    name: 'ledgerline.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  });
}

module.exports = createSessionConfig;

