// src/routes/user.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, SMSCampaign, SMSMessage, BalanceTransaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const smsService = require('../services/smsService');
const { Op } = require('sequelize');

const router = express.Router();

// Tüm kullanıcı route'ları için authentication gerekli
router.use(authenticateToken);

// Kullanıcı profili
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Kullanıcı istatistikleri
    const totalSMS = await SMSMessage.count({
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId: user.id }
      }]
    });

    const deliveredSMS = await SMSMessage.count({
      where: { status: 'delivered' },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId: user.id }
      }]
    });

    const totalSpent = await BalanceTransaction.sum('amount', {
      where: {
        userId: user.id,
        transactionType: 'debit'
      }
    }) || 0;

    res.json({
      user: user.toJSON(),
      stats: {
        totalSMS,
        deliveredSMS,
        successRate: totalSMS > 0 ? ((deliveredSMS / totalSMS) * 100).toFixed(2) : 0,
        totalSpent: parseFloat(totalSpent).toFixed(2)
      }
    });

  } catch (error) {
    console.error('Profil hatası:', error);
    res.status(500).json({
      error: 'Profil bilgileri alınırken hata oluştu'
    });
  }
});

// Profil güncelle
router.put('/profile', [
  body('firstName').optional().notEmpty().withMessage('Ad boş olamaz'),
  body('lastName').optional().notEmpty().withMessage('Soyad boş olamaz'),
  body('email').optional().isEmail().withMessage('Geçerli email adresi girin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { firstName, lastName, email } = req.body;
    const userId = req.user.userId;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Email değişikliği kontrolü
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: { email, id: { [Op.ne]: userId } }
      });
      
      if (existingUser) {
        return res.status(400).json({
          error: 'Bu email adresi zaten kullanılıyor'
        });
      }
    }

    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email;

    await user.update(updates);

    const { password: _, ...userWithoutPassword } = user.toJSON();

    res.json({
      message: 'Profil başarıyla güncellendi',
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Profil güncelleme hatası:', error);
    res.status(500).json({
      error: 'Profil güncellenirken hata oluştu'
    });
  }
});

// Bakiye bilgisi
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByPk(userId, {
      attributes: ['balance']
    });

    if (!user) {
      return res.status(404).json({
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Son 10 bakiye hareketi
    const recentTransactions = await BalanceTransaction.findAll({
      where: { userId },
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      balance: parseFloat(user.balance).toFixed(2),
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: parseFloat(t.amount).toFixed(2),
        description: t.description,
        createdAt: t.createdAt
      }))
    });

  } catch (error) {
    console.error('Bakiye bilgisi hatası:', error);
    res.status(500).json({
      error: 'Bakiye bilgileri alınırken hata oluştu'
    });
  }
});

// Tekli SMS gönder
router.post('/send-sms', [
  body('title').isLength({ max: 11 }).withMessage('Gönderici adı maksimum 11 karakter olmalı'),
  body('text').isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı'),
  body('recipient').isMobilePhone('tr-TR').withMessage('Geçerli bir Türkiye telefon numarası girin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { title, text, recipient } = req.body;
    const userId = req.user.userId;

    // SMS gönder
    const result = await smsService.sendSingleSMS(userId, {
      title,
      text,
      recipient,
      reportEnabled: true
    });

    res.json(result);

  } catch (error) {
    console.error('SMS gönderim hatası:', error);
    res.status(400).json({
      error: error.message || 'SMS gönderilirken hata oluştu'
    });
  }
});

// Toplu SMS gönder
router.post('/send-bulk-sms', [
  body('title').isLength({ max: 11 }).withMessage('Gönderici adı maksimum 11 karakter olmalı'),
  body('text').isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı'),
  body('recipients').isArray({ min: 1, max: 1000 }).withMessage('1-1000 arasında alıcı olmalı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { title, text, recipients } = req.body;
    const userId = req.user.userId;

    // Toplu SMS gönder
    const result = await smsService.sendBulkSMS(userId, {
      title,
      text,
      recipients,
      reportEnabled: true
    });

    res.json(result);

  } catch (error) {
    console.error('Toplu SMS gönderim hatası:', error);
    res.status(400).json({
      error: error.message || 'Toplu SMS gönderilirken hata oluştu'
    });
  }
});

// SMS geçmişi
router.get('/sms-history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const offset = (page - 1) * limit;
    const userId = req.user.userId;

    // Filtreleme koşulları
    const whereConditions = { userId };

    if (status) {
      whereConditions.status = status;
    }

    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const { count, rows: campaigns } = await SMSCampaign.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: SMSMessage,
        as: 'messages'
      }]
    });

    res.json({
      campaigns: campaigns.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        messageText: campaign.messageText,
        totalRecipients: campaign.totalRecipients,
        successfulSends: campaign.successfulSends,
        failedSends: campaign.failedSends,
        cost: parseFloat(campaign.cost).toFixed(2),
        status: campaign.status,
        createdAt: campaign.createdAt,
        messagesCount: campaign.messages.length
      })),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('SMS geçmişi hatası:', error);
    res.status(500).json({
      error: 'SMS geçmişi alınırken hata oluştu'
    });
  }
});

// Kampanya detayları
router.get('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const campaign = await SMSCampaign.findOne({
      where: { id, userId },
      include: [{
        model: SMSMessage,
        as: 'messages',
        order: [['createdAt', 'DESC']]
      }]
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

// SMS maliyeti hesaplama
router.post('/calculate-cost', [
  body('text').isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı'),
  body('recipients').isArray({ min: 1 }).withMessage('En az 1 alıcı gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { text, recipients } = req.body;

    // Geçerli telefon numaralarını say
    const validRecipients = recipients.filter(number => {
      const cleanNumber = number.replace(/\s+/g, '');
      return /^90[0-9]{10}$/.test(cleanNumber);
    });

    if (validRecipients.length === 0) {
      return res.status(400).json({
        error: 'Geçerli telefon numarası bulunamadı'
      });
    }

    const costInfo = smsService.calculateSMSCost(text, validRecipients.length);

    res.json({
      messageLength: text.length,
      messageCount: costInfo.messageCount,
      totalRecipients: recipients.length,
      validRecipients: validRecipients.length,
      invalidRecipients: recipients.length - validRecipients.length,
      perSMSCost: parseFloat(costInfo.perSMS).toFixed(4),
      totalCost: parseFloat(costInfo.totalCost).toFixed(2)
    });

  } catch (error) {
    console.error('Maliyet hesaplama hatası:', error);
    res.status(500).json({
      error: 'Maliyet hesaplanırken hata oluştu'
    });
  }
});

// Bakiye hareketleri
router.get('/balance-transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const type = req.query.type || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    const offset = (page - 1) * limit;
    const userId = req.user.userId;

    // Filtreleme koşulları
    const whereConditions = { userId };

    if (type) {
      whereConditions.transactionType = type;
    }

    if (startDate && endDate) {
      whereConditions.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const { count, rows: transactions } = await BalanceTransaction.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: parseFloat(t.amount).toFixed(2),
        description: t.description,
        createdAt: t.createdAt
      })),
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Bakiye hareketleri hatası:', error);
    res.status(500).json({
      error: 'Bakiye hareketleri alınırken hata oluştu'
    });
  }
});

// Dashboard istatistikleri
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Kullanıcı bilgileri
    const user = await User.findByPk(userId, {
      attributes: ['balance', 'firstName', 'lastName']
    });

    // SMS istatistikleri
    const totalSMS = await SMSMessage.count({
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

    const todaySMS = await SMSMessage.count({
      where: { createdAt: { [Op.gte]: startOfDay } },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

    const weekSMS = await SMSMessage.count({
      where: { createdAt: { [Op.gte]: startOfWeek } },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

    const monthSMS = await SMSMessage.count({
      where: { createdAt: { [Op.gte]: startOfMonth } },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

    // Başarı oranları
    const deliveredSMS = await SMSMessage.count({
      where: { status: 'delivered' },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

    const failedSMS = await SMSMessage.count({
      where: { status: 'failed' },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

    // Harcama istatistikleri
    const totalSpent = await BalanceTransaction.sum('amount', {
      where: {
        userId,
        transactionType: 'debit'
      }
    }) || 0;

    const monthSpent = await BalanceTransaction.sum('amount', {
      where: {
        userId,
        transactionType: 'debit',
        createdAt: { [Op.gte]: startOfMonth }
      }
    }) || 0;

    // Son kampanyalar
    const recentCampaigns = await SMSCampaign.findAll({
      where: { userId },
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      user: {
        name: `${user.firstName} ${user.lastName}`,
        balance: parseFloat(user.balance).toFixed(2)
      },
      sms: {
        total: totalSMS,
        today: todaySMS,
        week: weekSMS,
        month: monthSMS,
        delivered: deliveredSMS,
        failed: failedSMS,
        successRate: totalSMS > 0 ? ((deliveredSMS / totalSMS) * 100).toFixed(2) : 0
      },
      spending: {
        total: parseFloat(totalSpent).toFixed(2),
        month: parseFloat(monthSpent).toFixed(2)
      },
      recentCampaigns: recentCampaigns.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        totalRecipients: campaign.totalRecipients,
        status: campaign.status,
        cost: parseFloat(campaign.cost).toFixed(2),
        createdAt: campaign.createdAt
      }))
    });

  } catch (error) {
    console.error('Kullanıcı dashboard hatası:', error);
    res.status(500).json({
      error: 'Dashboard verileri alınırken hata oluştu'
    });
  }
});

module.exports = router;