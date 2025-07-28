// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');

const router = express.Router();

// JWT token oluşturma fonksiyonu
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// Kayıt olma
router.post('/register', [
  body('username').isLength({ min: 3, max: 50 }).withMessage('Kullanıcı adı 3-50 karakter olmalı'),
  body('email').isEmail().withMessage('Geçerli bir email adresi girin'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  body('firstName').notEmpty().withMessage('Ad gerekli'),
  body('lastName').notEmpty().withMessage('Soyad gerekli')
], async (req, res) => {
  try {
    // Validation kontrolü
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Kullanıcı var mı kontrol et
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Bu kullanıcı adı veya email zaten kullanılıyor'
      });
    }

    // Şifreyi hashle
    const hashedPassword = await bcrypt.hash(password, 12);

    // API key oluştur
    const apiKey = uuidv4();

    // Kullanıcıyı oluştur
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      apiKey,
      role: 'user',
      balance: 0.00,
      status: 'active'
    });

    // Token oluştur
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      message: 'Hesap başarıyla oluşturuldu',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        balance: user.balance,
        apiKey: user.apiKey,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({
      error: 'Hesap oluşturulurken hata oluştu'
    });
  }
});

// Giriş yapma
router.post('/login', [
  body('username').notEmpty().withMessage('Kullanıcı adı gerekli'),
  body('password').notEmpty().withMessage('Şifre gerekli')
], async (req, res) => {
  try {
    // Validation kontrolü
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { username, password } = req.body;

    // Kullanıcıyı bul
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    // Hesap aktif mi kontrol et
    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin.'
      });
    }

    // Şifreyi kontrol et
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Kullanıcı adı veya şifre hatalı'
      });
    }

    // Token oluştur
    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Giriş başarılı',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        balance: user.balance,
        apiKey: user.apiKey,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({
      error: 'Giriş yapılırken hata oluştu'
    });
  }
});

// Token doğrulama
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Token bulunamadı'
      });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kullanıcıyı bul
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'Geçersiz token'
      });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        balance: user.balance,
        apiKey: user.apiKey,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    res.status(401).json({
      error: 'Geçersiz token'
    });
  }
});

// backend/src/routes/auth.js dosyasına EKLE (dosyanın sonuna)

// Token doğrulama endpoint'i - EKSİK OLAN BU!
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Token bulunamadı'
      });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kullanıcıyı bul
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });
    
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

    res.json({
      valid: true,
      user: user.toJSON()
    });

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
});

module.exports = router;