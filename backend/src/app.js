// src/app.js - DÜZELTİLMİŞ VERSİYON
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

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : [
        'http://localhost:3000',
        'http://localhost:5173',  // ← YENİ EKLENEN
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'   // ← YENİ EKLENEN
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // maksimum 100 istek
  message: {
    error: 'Çok fazla istek gönderildi, lütfen 15 dakika sonra tekrar deneyin.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

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
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/sms', smsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SMS Reseller Panel API çalışıyor',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
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
    }
  });
});

// 404 handler - Routes'lardan sonra
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint bulunamadı',
    path: req.originalUrl,
    method: req.method,
    message: 'Bu endpoint mevcut değil. /api/health adresini kontrol edin.'
  });
});

// Global error handler - En son
app.use((error, req, res, next) => {
  console.error('❌ Sunucu Hatası:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Sequelize hataları için özel handling
  if (error.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      error: 'Veritabanı bağlantı hatası',
      message: 'Lütfen daha sonra tekrar deneyin.'
    });
  }

  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Veri doğrulama hatası',
      details: error.errors?.map(e => e.message) || []
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Geçersiz token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token süresi dolmuş'
    });
  }

  // Default error response
  res.status(error.status || 500).json({
    error: error.message || 'Sunucu hatası',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error 
    })
  });
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

    // Veritabanı bağlantısını test et
    await sequelize.authenticate();
    console.log('✅ Veritabanı bağlantısı başarılı');

    // Tabloları oluştur/güncelle (development için)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ Veritabanı tabloları güncellendi');
    } else {
      // Production'da sadece kontrol et
      await sequelize.sync({ force: false });
      console.log('✅ Veritabanı tabloları kontrol edildi');
    }

    // Sunucuyu başlat
    const server = app.listen(PORT, () => {
      console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor`);
      console.log(`📱 SMS Reseller Panel Backend hazır!`);
      console.log(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown setup
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 ${signal} sinyali alındı. Sunucu kapatılıyor...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server kapatıldı');
        
        try {
          await sequelize.close();
          console.log('🗄️ Veritabanı bağlantısı kapatıldı');
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