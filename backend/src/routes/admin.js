// src/routes/admin.js - RAPORLAMA ENDPOİNT'LERİ EKLENDİ
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User, SMSCampaign, SMSMessage, BalanceTransaction } = require('../models');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const smsService = require('../services/smsService'); // SMS servisini import et

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

// SMS raporları - RAPORLAMA BİLGİLERİ EKLENDİ
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
      where: { ...campaignWhere, ...whereConditions },
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
          required: false
        }
      ]
    });

    // Kampanyaları raporlama bilgileri ile birlikte döndür
    const campaignsWithReports = campaigns.map(campaign => ({
      id: campaign.id,
      title: campaign.title,
      messageText: campaign.messageText,
      totalRecipients: campaign.totalRecipients,
      successfulSends: campaign.successfulSends,
      failedSends: campaign.failedSends,
      cost: campaign.cost,
      status: campaign.status,
      createdAt: campaign.createdAt,
      user: campaign.user,
      // Raporlama bilgileri
      reportId: campaign.reportId,
      lastReportCheck: campaign.lastReportCheck,
      deliveredCount: campaign.deliveredCount || 0,
      failedCount: campaign.failedCount || 0,
      invalidCount: campaign.invalidCount || 0,
      blockedCount: campaign.blockedCount || 0,
      turkcellCount: campaign.turkcellCount || 0,
      vodafoneCount: campaign.vodafoneCount || 0,
      turktelekomCount: campaign.turktelekomCount || 0
    }));

    res.json({
      campaigns: campaignsWithReports,
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

// SMS ayarlarını güncelleme
router.put('/users/:id/sms-settings', [
  body('smsTitle').optional().isLength({ max: 20 }).withMessage('SMS başlığı maksimum 20 karakter olmalı'),
  body('smsApiKey').optional().isLength({ min: 10 }).withMessage('SMS API key en az 10 karakter olmalı')
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
    const { smsTitle, smsApiKey } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Admin kullanıcısının SMS ayarlarını düzenlemeyi engelle
    if (user.role === 'admin') {
      return res.status(403).json({
        error: 'Admin kullanıcısının SMS ayarları düzenlenemez'
      });
    }

    const updateData = {};
    if (smsTitle !== undefined) updateData.smsTitle = smsTitle;
    if (smsApiKey !== undefined) updateData.smsApiKey = smsApiKey;

    await user.update(updateData);

    res.json({
      message: 'SMS ayarları başarıyla güncellendi',
      smsSettings: {
        smsTitle: user.smsTitle,
        smsApiKey: user.smsApiKey
      }
    });

  } catch (error) {
    console.error('SMS ayarları güncelleme hatası:', error);
    res.status(500).json({
      error: 'SMS ayarları güncellenirken hata oluştu'
    });
  }
});

// Test SMS gönderme endpoint'i
router.post('/test-sms', [
  body('phoneNumber').matches(/^90[0-9]{10}$/).withMessage('Geçersiz telefon numarası formatı'),
  body('message').optional().isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { phoneNumber, message } = req.body;

    console.log('🧪 Admin test SMS gönderimi:', { phoneNumber, message });

    const result = await smsService.sendTestSMS(phoneNumber, message);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test SMS başarıyla gönderildi',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Test SMS gönderilemedi',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Test SMS hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Test SMS gönderilirken hata oluştu'
    });
  }
});

// YENİ RAPORLAMA ENDPOİNT'LERİ

// Kampanya detaylarını getir
router.get('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await SMSCampaign.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'firstName', 'lastName', 'email']
        },
        {
          model: SMSMessage,
          as: 'messages',
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!campaign) {
      return res.status(404).json({
        error: 'Kampanya bulunamadı'
      });
    }

    res.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        messageText: campaign.messageText,
        totalRecipients: campaign.totalRecipients,
        successfulSends: campaign.successfulSends,
        failedSends: campaign.failedSends,
        cost: parseFloat(campaign.cost).toFixed(2),
        status: campaign.status,
        createdAt: campaign.createdAt,
        user: campaign.user,
        // Raporlama bilgileri
        reportId: campaign.reportId,
        lastReportCheck: campaign.lastReportCheck,
        reportData: campaign.reportData,
        deliveredCount: campaign.deliveredCount || 0,
        failedCount: campaign.failedCount || 0,
        invalidCount: campaign.invalidCount || 0,
        blockedCount: campaign.blockedCount || 0,
        turkcellCount: campaign.turkcellCount || 0,
        vodafoneCount: campaign.vodafoneCount || 0,
        turktelekomCount: campaign.turktelekomCount || 0,
        messages: campaign.messages.map(msg => ({
          id: msg.id,
          phoneNumber: msg.phoneNumber,
          status: msg.status,
          cost: parseFloat(msg.cost).toFixed(4),
          sentAt: msg.sentAt,
          deliveredAt: msg.deliveredAt,
          errorMessage: msg.errorMessage
        }))
      }
    });

  } catch (error) {
    console.error('Kampanya detayları hatası:', error);
    res.status(500).json({
      error: 'Kampanya detayları alınırken hata oluştu'
    });
  }
});

// Kampanya raporunu manuel güncelle
router.post('/campaigns/:id/update-report', async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await SMSCampaign.findByPk(id);
    if (!campaign) {
      return res.status(404).json({
        error: 'Kampanya bulunamadı'
      });
    }

    if (!campaign.reportId) {
      return res.status(400).json({
        error: 'Bu kampanya için rapor ID bulunamadı'
      });
    }

    // Raporu güncelle
    await smsService.updateCampaignReport(id);

    // Güncellenmiş kampanyayı getir
    await campaign.reload();

    res.json({
      message: 'Kampanya raporu başarıyla güncellendi',
      reportData: {
        reportId: campaign.reportId,
        lastReportCheck: campaign.lastReportCheck,
        deliveredCount: campaign.deliveredCount,
        failedCount: campaign.failedCount,
        status: campaign.status
      }
    });

  } catch (error) {
    console.error('Kampanya rapor güncelleme hatası:', error);
    res.status(500).json({
      error: 'Kampanya raporu güncellenirken hata oluştu'
    });
  }
});

// TurkeySMS delivery raporu getir
router.get('/delivery-report/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await smsService.getDeliveryReport(reportId);

    if (!report) {
      return res.status(404).json({
        error: 'Rapor bulunamadı'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Delivery raporu hatası:', error);
    res.status(500).json({
      error: 'Delivery raporu alınırken hata oluştu'
    });
  }
});

module.exports = router;