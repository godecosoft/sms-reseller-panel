// src/routes/user.js - TEK API ENDPOINT + YENİ KREDİ SİSTEMİ
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

    // Toplam kullanılan kredi
    const totalCreditsUsed = await BalanceTransaction.sum('amount', {
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
        totalCreditsUsed: Math.floor(parseFloat(totalCreditsUsed))
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

// Kredi bilgisi
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

    // Son 10 kredi hareketi
    const recentTransactions = await BalanceTransaction.findAll({
      where: { userId },
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      balance: Math.floor(parseFloat(user.balance)),
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        type: t.transactionType,
        amount: Math.floor(parseFloat(t.amount)),
        description: t.description,
        createdAt: t.createdAt
      }))
    });

  } catch (error) {
    console.error('Kredi bilgisi hatası:', error);
    res.status(500).json({
      error: 'Kredi bilgileri alınırken hata oluştu'
    });
  }
});

// TEK SMS GÖNDERİM ENDPOİNT - BULK API KULLANIR
router.post('/send-sms', [
  body('text')
    .isLength({ min: 1, max: 149 })
    .withMessage('Mesaj 1-149 karakter arası olmalı'),
  body('recipients')
    .custom((value) => {
      // String olarak tek numara veya array olarak çoklu numara kabul et
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          throw new Error('En az bir telefon numarası gerekli');
        }
        if (value.length > 100000) {
          throw new Error('Maksimum 100.000 numara gönderilebilir');
        }
        return true;
      }
      throw new Error('Recipients string veya array olmalı');
    })
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

    // Recipients'ı array'e dönüştür
    let recipientList = [];
    if (typeof recipients === 'string') {
      recipientList = [recipients];
    } else if (Array.isArray(recipients)) {
      recipientList = recipients;
    }

    // SMS gönder - YENİ BULK API
    const result = await smsService.sendSMS(userId, {
      title,
      text,
      recipients: recipientList,
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

// BULK SMS ENDPOINT KALDIRILDI - ARTIK TEK ENDPOINT VAR

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
        totalRecipients: campaign.totalRecipients, // Girilen numara sayısı
        successfulSends: campaign.successfulSends, // Geçerli numara sayısı
        failedSends: campaign.failedSends, // Geçersiz numara sayısı
        creditsUsed: campaign.cost, // Toplam kullanılan kredi (girilen numara sayısı)
        status: campaign.status,
        createdAt: campaign.createdAt,
        messagesCount: campaign.messages.length,
        // Raporlama verileri
        reportId: campaign.reportId,
        lastReportCheck: campaign.lastReportCheck,
        deliveredCount: campaign.deliveredCount || 0,
        failedCount: campaign.failedCount || 0,
        invalidCount: campaign.invalidCount || 0,
        blockedCount: campaign.blockedCount || 0,
        turkcellCount: campaign.turkcellCount || 0,
        vodafoneCount: campaign.vodafoneCount || 0,
        turktelekomCount: campaign.turktelekomCount || 0
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
        totalRecipients: campaign.totalRecipients, // Girilen toplam numara
        successfulSends: campaign.successfulSends, // Geçerli ve gönderilen
        failedSends: campaign.failedSends, // Geçersiz format
        creditsUsed: campaign.cost, // Girilen numara sayısı kadar kredi
        status: campaign.status,
        createdAt: campaign.createdAt,
        // Raporlama verileri
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
          creditsUsed: 1, // Her numara için 1 kredi
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

// Kredi hareketleri
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
        amount: Math.floor(parseFloat(t.amount)),
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
    console.error('Kredi hareketleri hatası:', error);
    res.status(500).json({
      error: 'Kredi hareketleri alınırken hata oluştu'
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

    // Kredi kullanım istatistikleri
    const totalCreditsUsed = await BalanceTransaction.sum('amount', {
      where: {
        userId,
        transactionType: 'debit'
      }
    }) || 0;

    const monthCreditsUsed = await BalanceTransaction.sum('amount', {
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
        balance: Math.floor(parseFloat(user.balance))
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
      credits: {
        total: Math.floor(parseFloat(totalCreditsUsed)),
        month: Math.floor(parseFloat(monthCreditsUsed))
      },
      recentCampaigns: recentCampaigns.map(campaign => ({
        id: campaign.id,
        title: campaign.title,
        totalRecipients: campaign.totalRecipients,
        status: campaign.status,
        creditsUsed: campaign.cost, // Girilen numara sayısı kadar kredi
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

// Kampanya raporunu manuel güncelle
router.post('/campaigns/:id/update-report', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const campaign = await SMSCampaign.findOne({
      where: { id, userId }
    });

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