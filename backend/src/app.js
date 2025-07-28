// src/app.js - DÜZELTİLMİŞ VERSİYON (CORS VE ERROR HANDLING İYİLEŞTİRİLDİ)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const smsRoutes = require('./routes/sms');

const app = express();
const PORT = process.env.PORT || 5000;

// Güvenlik middleware'leri
app.use(helmet({
  contentSecurityPolicy: false, // Frontend için gerekli
  crossOriginEmbedderPolicy: false
}));

// CORS - DÜZELTİLMİŞ KONFİGÜRASYON
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : [
        'http://localhost:3000',
        'http://localhost:5173',  // Vite default port
        'http://localhost:4173',  // Vite preview port
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting - İYİLEŞTİRİLMİŞ
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // maksimum 100 istek
  message: {
    error: 'Çok fazla istek gönderildi, lütfen 15 dakika sonra tekrar deneyin.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth için özel rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10, // maksimum 10 auth işlemi
  message: {
    error: 'Çok fazla giriş denemesi, lütfen 15 dakika sonra tekrar deneyin.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);

// Body parser middleware
app.use(express.json({ 
  limit: '10mb',
  strict: false
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request logging (development için)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Request Body:', JSON.stringify(req.body, null, 2));
    }
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/sms', smsRoutes);

// Health check endpoint - GENİŞLETİLMİŞ
app.get('/api/health', async (req, res) => {
  try {
    // Veritabanı bağlantısını test et
    await sequelize.authenticate();
    
    res.json({ 
      status: 'OK', 
      message: 'SMS Reseller Panel API çalışıyor',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'Connected',
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check database error:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'Veritabanı bağlantı sorunu',
      timestamp: new Date().toISOString(),
      database: 'Disconnected'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SMS Reseller Panel API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      admin: '/api/admin',
      user: '/api/user',
      sms: '/api/sms'
    },
    documentation: {
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      verify: 'GET /api/auth/verify'
    }
  });
});

// 404 handler - Routes'lardan sonra
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint bulunamadı',
    path: req.originalUrl,
    method: req.method,
    message: 'Bu endpoint mevcut değil. /api/health adresini kontrol edin.',
    availableEndpoints: ['/api/health', '/api/auth', '/api/admin', '/api/user', '/api/sms']
  });
});

// Global error handler - İYİLEŞTİRİLMİŞ
app.use((error, req, res, next) => {
  // Error logging
  console.error('❌ Sunucu Hatası:', {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Sequelize hataları için özel handling
  if (error.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      error: 'Veritabanı bağlantı hatası',
      message: 'Lütfen daha sonra tekrar deneyin.',
      code: 'DB_CONNECTION_ERROR'
    });
  }

  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Veri doğrulama hatası',
      details: error.errors?.map(e => e.message) || [],
      code: 'VALIDATION_ERROR'
    });
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      error: 'Bu veri zaten mevcut',
      details: error.errors?.map(e => `${e.path}: ${e.value}`) || [],
      code: 'UNIQUE_CONSTRAINT_ERROR'
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Geçersiz token',
      code: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token süresi dolmuş',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Axios/HTTP hataları
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Harici servis bağlantı hatası',
      message: 'SMS API\'ye ulaşılamıyor',
      code: 'EXTERNAL_SERVICE_ERROR'
    });
  }

  // Default error response
  const statusCode = error.status || error.statusCode || 500;
  const errorResponse = {
    error: error.message || 'Sunucu hatası',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  };

  // Development ortamında daha fazla bilgi
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  res.status(statusCode).json(errorResponse);
});

// Veritabanı bağlantısı ve sunucu başlatma
async function startServer() {
  try {
    console.log('🔄 Sunucu başlatılıyor...');
    
    // Çevre değişkenlerini kontrol et
    const requiredEnvVars = ['DB_NAME', 'DB_USER', 'JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      throw new Error(`Eksik çevre değişkenleri: ${missingEnvVars.join(', ')}`);
    }

    // JWT Secret güvenlik kontrolü
    if (process.env.JWT_SECRET.length < 32) {
      console.warn('⚠️  JWT_SECRET çok kısa, güvenlik riski oluşturabilir');
    }

    // Veritabanı bağlantısını test et
    await sequelize.authenticate();
    console.log('✅ Veritabanı bağlantısı başarılı');

    // Tabloları oluştur/güncelle
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Veritabanı tabloları güncellendi (development)');
    } else {
      await sequelize.sync({ force: false });
      console.log('✅ Veritabanı tabloları kontrol edildi (production)');
    }

    // Sunucuyu başlat
    const server = app.listen(PORT, () => {
      console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
      console.log(`📱 SMS Reseller Panel Backend hazır!`);
      console.log(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📚 API Docs: http://localhost:${PORT}/`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development modunda çalışıyor - debug logları aktif');
      }
    });

    // Server timeout ayarları
    server.timeout = 30000; // 30 saniye
    server.keepAliveTimeout = 65000; // 65 saniye
    server.headersTimeout = 66000; // 66 saniye

    // Graceful shutdown setup
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 ${signal} sinyali alındı. Sunucu kapatılıyor...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server kapatıldı');
        
        try {
          await sequelize.close();
          console.log('🗄️ Veritabanı bağlantısı kapatıldı');
          console.log('✅ Graceful shutdown tamamlandı');
          process.exit(0);
        } catch (error) {
          console.error('❌ Veritabanı kapatma hatası:', error);
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Zorla kapatılıyor...');
        process.exit(1);
      }, 10000);
    };

    // Signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Promise Rejection:', reason);
      console.error('Promise:', promise);
      // Production'da sunucuyu kapat
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Sunucu başlatma hatası:', error);
    process.exit(1);
  }
}

// Sunucuyu başlat
startServer();