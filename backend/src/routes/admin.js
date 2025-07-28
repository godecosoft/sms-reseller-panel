// src/routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User, SMSCampaign, SMSMessage, BalanceTransaction } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const router = express.Router();

// Tüm admin route'ları için authentication ve admin yetkisi gerekli
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard istatistikleri
router.get('/dashboard-stats', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Kullanıcı istatistikleri
    const totalUsers = await User.count({ where: { role: 'user' } });
    const activeUsers = await User.count({ 
      where: { role: 'user', status: 'active' } 
    });

    // SMS istatistikleri
    const totalSMSSent = await SMSMessage.count();
    const todaySMSSent = await SMSMessage.count({
      where: {
        createdAt: { [Op.gte]: startOfDay }
      }
    });
    const monthSMSSent = await SMSMessage.count({
      where: {
        createdAt: { [Op.gte]: startOfMonth }
      }
    });

    // Başarı oranları
    const deliveredSMS = await SMSMessage.count({
      where: { status: 'delivered' }
    });
    const failedSMS = await SMSMessage.count({
      where: { status: 'failed' }
    });

    // Gelir istatistikleri
    const totalRevenue = await BalanceTransaction.sum('amount', {
      where: { transactionType: 'debit' }
    }) || 0;
    
    const todayRevenue = await BalanceTransaction.sum('amount', {
      where: {
        transactionType: 'debit',
        createdAt: { [Op.gte]: startOfDay }
      }
    }) || 0;

    const monthRevenue = await BalanceTransaction.sum('amount', {
      where: {
        transactionType: 'debit',
        createdAt: { [Op.gte]: startOfMonth }
      }
    }) || 0;

    // Toplam bakiye
    const totalBalance = await User.sum('balance') || 0;

    // Son kampanyalar
    const recentCampaigns = await SMSCampaign.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['username', 'firstName', 'lastName']
      }]
    });

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      sms: {
        total: totalSMSSent,
        today: todaySMSSent,
        month: monthSMSSent,
        delivered: deliveredSMS,
        failed: failedSMS,
        successRate: totalSMSSent > 0 ? ((deliveredSMS / totalSMSSent) * 100).toFixed(2) : 0
      },
      revenue: {
        total: parseFloat(totalRevenue).toFixed(2),
        today: parseFloat(todayRevenue).toFixed(2),
        month: parseFloat(monthRevenue).toFixed(2)
      },
      balance: {
        total: parseFloat(totalBalance).toFixed(2)
      },
      recentCampaigns: recentCampaigns.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        user: `${campaign.user.firstName} ${campaign.user.lastName}`,
        username: campaign.user.username,
        totalRecipients: campaign.totalRecipients,
        status: campaign.status,
        cost: campaign.cost,
        createdAt: campaign.createdAt
      }))
    });

  } catch (error) {
    console.error('Dashboard istatistikleri hatası:', error);
    res.status(500).json({
      error: 'Dashboard verileri alınırken hata oluştu'
    });
  }
});

// Tüm kullanıcıları listele
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const offset = (page - 1) * limit;

    // Arama ve filtreleme koşulları
    const whereConditions = {
      role: 'user'
    };

    if (search) {
      whereConditions[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      whereConditions.status = status;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    // Her kullanıcı için SMS istatistikleri
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const smsCount = await SMSMessage.count({
          include: [{
            model: SMSCampaign,
            as: 'campaign',
            where: { userId: user.id }
          }]
        });

        const lastSMS = await SMSCampaign.findOne({
          where: { userId: user.id },
          order: [['createdAt', 'DESC']]
        });

        return {
          ...user.toJSON(),
          smsCount,
          lastSMSDate: lastSMS?.createdAt || null
        };
      })
    );

    res.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Kullanıcı listesi hatası:', error);
    res.status(500).json({
      error: 'Kullanıcı listesi alınırken hata oluştu'
    });
  }
});

// Yeni kullanıcı oluştur
router.post('/users', [
  body('username').isLength({ min: 3, max: 50 }).withMessage('Kullanıcı adı 3-50 karakter olmalı'),
  body('email').isEmail().withMessage('Geçerli bir email adresi girin'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  body('firstName').notEmpty().withMessage('Ad gerekli'),
  body('lastName').notEmpty().withMessage('Soyad gerekli'),
  body('balance').optional().isNumeric().withMessage('Bakiye sayısal olmalı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, balance = 0 } = req.body;

    // Kullanıcı var mı kontrol et
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
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
      balance: parseFloat(balance),
      status: 'active'
    });

    // Eğer başlangıç bakiyesi varsa işlem kaydı oluştur
    if (parseFloat(balance) > 0) {
      await BalanceTransaction.create({
        userId: user.id,
        transactionType: 'credit',
        amount: parseFloat(balance),
        description: 'Admin tarafından başlangıç bakiyesi',
        referenceId: user.id
      });
    }

    const { password: _, ...userWithoutPassword } = user.toJSON();

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Kullanıcı oluşturma hatası:', error);
    res.status(500).json({
      error: 'Kullanıcı oluşturulurken hata oluştu'
    });
  }
});

// Kullanıcıyı düzenle
router.put('/users/:id', [
  body('username').optional().isLength({ min: 3, max: 50 }),
  body('email').optional().isEmail(),
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Admin kullanıcısını düzenlemeyi engelle
    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Admin kullanıcısı düzenlenemez'
      });
    }

    // Şifre güncellemesi varsa hashle
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }

    await user.update(updates);

    const { password: _, ...userWithoutPassword } = user.toJSON();

    res.json({
      message: 'Kullanıcı başarıyla güncellendi',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Kullanıcı güncelleme hatası:', error);
    res.status(500).json({
      error: 'Kullanıcı güncellenirken hata oluştu'
    });
  }
});

// Kullanıcıya bakiye ekle
router.post('/users/:id/add-balance', [
  body('amount').isNumeric().withMessage('Miktar sayısal olmalı'),
  body('description').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { amount, description = 'Admin tarafından bakiye eklendi' } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    const amountFloat = parseFloat(amount);
    if (amountFloat <= 0) {
      return res.status(400).json({
        error: 'Miktar pozitif olmalı'
      });
    }

    // Bakiye güncelle
    await user.update({
      balance: parseFloat(user.balance) + amountFloat
    });

    // İşlem kaydı oluştur
    await BalanceTransaction.create({
      userId: user.id,
      transactionType: 'credit',
      amount: amountFloat,
      description,
      referenceId: user.id
    });

    res.json({
      message: 'Bakiye başarıyla eklendi',
      newBalance: user.balance,
      addedAmount: amountFloat
    });

  } catch (error) {
    console.error('Bakiye ekleme hatası:', error);
    res.status(500).json({
      error: 'Bakiye eklenirken hata oluştu'
    });
  }
});

// Kullanıcıyı sil
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Admin kullanıcısını silmeyi engelle
    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Admin kullanıcısı silinemez'
      });
    }

    await user.destroy();

    res.json({
      message: 'Kullanıcı başarıyla silindi'
    });

  } catch (error) {
    console.error('Kullanıcı silme hatası:', error);
    res.status(500).json({
      error: 'Kullanıcı silinirken hata oluştu'
    });
  }
});

// SMS raporları
router.get('/sms-reports', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.query.userId || '';
    const status = req.query.status || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const offset = (page - 1) * limit;

    // Filtreleme koşulları
    const whereConditions = {};

    if (status) {
      whereConditions.status = status;
    }

    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const campaignWhere = {};
    if (userId) {
      campaignWhere.userId = userId;
    }

    const { count, rows: campaigns } = await SMSCampaign.findAndCountAll({
      where: campaignWhere,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'firstName', 'lastName']
        },
        {
          model: SMSMessage,
          as: 'messages',
          where: whereConditions,
          required: false
        }
      ]
    });

    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('SMS raporları hatası:', error);
    res.status(500).json({
      error: 'SMS raporları alınırken hata oluştu'
    });
  }
});

module.exports = router;