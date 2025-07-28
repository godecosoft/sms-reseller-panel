// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Token doğrulama middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Erişim token\'ı gerekli'
      });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kullanıcıyı bul
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'Geçersiz token - kullanıcı bulunamadı'
      });
    }

    // Kullanıcı aktif mi kontrol et
    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Hesap aktif değil'
      });
    }

    // Kullanıcı bilgilerini req objesine ekle
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    };

    next();

  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    
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

    return res.status(500).json({
      error: 'Token doğrulama sırasında hata oluştu'
    });
  }
};

// Admin yetkisi kontrolü
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Bu işlem için admin yetkisi gerekli'
    });
  }
  next();
};

// API Key doğrulama middleware (SMS API için)
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key gerekli'
      });
    }

    // API key ile kullanıcıyı bul
    const user = await User.findOne({
      where: { apiKey, status: 'active' }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Geçersiz API key'
      });
    }

    // Kullanıcı bilgilerini req objesine ekle
    req.user = {
      userId: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    };

    next();

  } catch (error) {
    console.error('API key doğrulama hatası:', error);
    return res.status(500).json({
      error: 'API key doğrulama sırasında hata oluştu'
    });
  }
};

// Rate limiting için kullanıcı bazlı key oluşturma
const getUserKeyGenerator = (req) => {
  if (req.user) {
    return `user_${req.user.userId}`;
  }
  return req.ip;
};

module.exports = {
  authenticateToken,
  requireAdmin,
  authenticateApiKey,
  getUserKeyGenerator
};