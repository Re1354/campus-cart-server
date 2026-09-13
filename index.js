const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');

dotenv.config();

// Initialize passport config (registers Google strategy)
const passport = require('./src/config/passport');

// Route modules
const authRoutes = require('./src/routes/auth.routes');
const categoryRoutes = require('./src/modules/category/category.routes');
const productRoutes = require('./src/modules/product/product.routes');
const cartRoutes = require('./src/modules/cart/cart.routes');
const orderRoutes = require('./src/modules/order/order.routes');
const vendorDashboardRoutes = require('./src/modules/vendor/dashboard.routes');
const adminRoutes = require('./src/modules/admin/admin.routes');

// Global error handler (must be last)
const errorHandler = require('./src/middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile, curl, Postman) or matched allowed origins
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev to avoid subtle local blocking
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// express-session is required ONLY for the Google OAuth handshake (state param).
// After the callback sets the JWT cookie the session is destroyed.
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000, // 10 minutes — just long enough for OAuth round-trip
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Category routes
app.use('/api', categoryRoutes);

// Product routes
app.use('/api', productRoutes);

// Cart routes
app.use('/api/cart', cartRoutes);

// Order routes
app.use('/api', orderRoutes);

// Vendor dashboard routes
app.use('/api', vendorDashboardRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// ─── Global Error Handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
