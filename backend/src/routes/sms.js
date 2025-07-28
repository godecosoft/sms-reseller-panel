// src/routes/sms.js - TEK ENDPOİNT + YENİ KREDİ SİSTEMİ
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateApiKey } = require('../middleware/auth');
const smsService = require('../services/smsService');

const router = express.Router();

// Tüm SMS API route'ları için API key authentication gerekli
router.use(authenticateApiKey);

// TEK SMS GÖNDERİM ENDPOİNT - BULK API KULLANIR
router.post('/send', [
  body('title').optional().isLength({ max: 11 }).withMessage('Gönderici adı maksimum 11 karakter olmalı'),
  body('text').isLength({ min: 1, max: 149 }).withMessage('Mesaj 1-149 karakter arası olmalı'),
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
        success: false,
        error: 'Geçersiz veriler',
        details: errors.array()
      });
    }

    const { title, text, recipients, report = true } = req.body;
    const userId = req.user.userId;

    // Recipients'ı array'e dönüştür
    let recipientList = [];
    if (typeof recipients === 'string') {
      recipientList = [recipients];
    } else if (Array.isArray(recipients)) {
      recipientList = recipients;
    }

    // SMS gönder - YENİ SİSTEM
    const result = await smsService.sendSMS(userId, {
      title,
      text,
      recipients: recipientList,
      reportEnabled: report
    });

    res.json({
      success: result.success,
      data: result
    });

  } catch (error) {
    console.error('API SMS gönderim hatası:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'SMS gönderilirken hata oluştu'
    });
  }
});

// ESKİ ENDPOİNT'LER KALDIRILDI - SADECE /send KULLANILACAK
// /send-single -> KALDIRILDI
// /send-bulk -> KALDIRILDI

// Delivery raporu alma (API)
router.get('/delivery-report/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.userId;

    // Kampanya sahibi kontrolü
    const { SMSCampaign, SMSMessage } = require('../models');
    const campaign = await SMSCampaign.findOne({
      where: { id: campaignId, userId },
      include: [{
        model: SMSMessage,
        as: 'messages'
      }]
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Kampanya bulunamadı'
      });
    }

    // Raporu güncelle
    try {
      await smsService.updateCampaignReport(campaignId);
    } catch (updateError) {
      console.log('Rapor güncelleme hatası:', updateError.message);
    }

    // Güncel verileri getir
    const updatedCampaign = await SMSCampaign.findByPk(campaignId, {
      include: [{
        model: SMSMessage,
        as: 'messages'
      }]
    });

    const report = {
      campaignId: updatedCampaign.id,
      title: updatedCampaign.title,
      messageText: updatedCampaign.messageText,
      totalInput: updatedCampaign.totalRecipients, // Girilen numara sayısı
      validSent: updatedCampaign.successfulSends, // Geçerli ve gönderilen
      invalidCount: updatedCampaign.failedSends, // Geçersiz format
      status: updatedCampaign.status,
      creditsUsed: updatedCampaign.cost, // Toplam kullanılan kredi
      createdAt: updatedCampaign.createdAt,
      // Raporlama bilgileri
      reportId: updatedCampaign.reportId,
      deliveredCount: updatedCampaign.deliveredCount || 0,
      failedCount: updatedCampaign.failedCount || 0,
      invalidCount: updatedCampaign.invalidCount || 0,
      blockedCount: updatedCampaign.blockedCount || 0,
      messages: updatedCampaign.messages.map(msg => ({
        phoneNumber: msg.phoneNumber,
        status: msg.status,
        sentAt: msg.sentAt,
        deliveredAt: msg.deliveredAt,
        errorMessage: msg.errorMessage,
        creditsUsed: 1 // Her numara için 1 kredi
      }))
    };

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Delivery raporu hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Delivery raporu alınırken hata oluştu'
    });
  }
});

// Kredi sorgulama (API)
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { User } = require('../models');

    const user = await User.findByPk(userId, {
      attributes: ['balance']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      data: {
        balance: Math.floor(parseFloat(user.balance)),
        unit: 'SMS Kredisi',
        note: 'Her girilen numara için 1 kredi düşülür'
      }
    });

  } catch (error) {
    console.error('API Kredi sorgulama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Kredi sorgulanırken hata oluştu'
    });
  }
});

// API kullanım istatistikleri
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { SMSCampaign, SMSMessage, BalanceTransaction } = require('../models');
    const { Op } = require('sequelize');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // SMS istatistikleri - Girilen numara bazında
    const totalNumbers = await SMSCampaign.sum('totalRecipients', {
      where: { userId }
    }) || 0;

    const todayNumbers = await SMSCampaign.sum('totalRecipients', {
      where: { 
        userId,
        createdAt: { [Op.gte]: startOfDay } 
      }
    }) || 0;

    const monthNumbers = await SMSCampaign.sum('totalRecipients', {
      where: { 
        userId,
        createdAt: { [Op.gte]: startOfMonth } 
      }
    }) || 0;

    // Başarılı gönderimler
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

    res.json({
      success: true,
      data: {
        totalNumbers: Math.floor(totalNumbers), // Toplam girilen numara
        todayNumbers: Math.floor(todayNumbers), // Bugün girilen numara
        monthNumbers: Math.floor(monthNumbers), // Bu ay girilen numara
        deliveredSMS, // Teslim edilen SMS
        failedSMS, // Başarısız SMS
        successRate: totalNumbers > 0 ? ((deliveredSMS / totalNumbers) * 100).toFixed(2) : 0,
        failureRate: totalNumbers > 0 ? ((failedSMS / totalNumbers) * 100).toFixed(2) : 0,
        totalCreditsUsed: Math.floor(parseFloat(totalCreditsUsed)),
        monthCreditsUsed: Math.floor(parseFloat(monthCreditsUsed)),
        creditingSystem: 'Her girilen numara için 1 kredi düşülür'
      }
    });

  } catch (error) {
    console.error('API İstatistikler hatası:', error);
    res.status(500).json({
      success: false,
      error: 'İstatistikler alınırken hata oluştu'
    });
  }
});

// SMS gönderim limitleri ve kuralları
router.get('/limits', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        maxRecipients: 100000,
        maxMessageLength: 149,
        minMessageLength: 1,
        creditPerNumber: 1,
        phoneFormat: '90XXXXXXXXXX',
        supportedFileTypes: ['txt'],
        maxFileSize: '10MB',
        schedulingEnabled: true,
        minimumScheduleTime: '5 minutes',
        apiEndpoint: '/api/sms/send',
        documentation: {
          singleSMS: 'Send recipients as string',
          multipleSMS: 'Send recipients as array',
          fileUpload: 'Upload .txt file with one number per line'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Limit bilgileri alınırken hata oluştu'
    });
  }
});

module.exports = router;