// src/routes/sms.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateApiKey } = require('../middleware/auth');
const smsService = require('../services/smsService');

const router = express.Router();

// Tüm SMS API route'ları için API key authentication gerekli
router.use(authenticateApiKey);

// Tekli SMS gönderimi (API)
router.post('/send-single', [
  body('title').isLength({ max: 11 }).withMessage('Gönderici adı maksimum 11 karakter olmalı'),
  body('text').isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı'),
  body('recipient').notEmpty().withMessage('Alıcı telefon numarası gerekli')
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

    const { title, text, recipient, report = true } = req.body;
    const userId = req.user.userId;

    // SMS gönder
    const result = await smsService.sendSingleSMS(userId, {
      title,
      text,
      recipient,
      reportEnabled: report
    });

    res.json({
      success: true,
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

// Toplu SMS gönderimi (API)
router.post('/send-bulk', [
  body('title').isLength({ max: 11 }).withMessage('Gönderici adı maksimum 11 karakter olmalı'),
  body('text').isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı'),
  body('recipients').isArray({ min: 1, max: 10000 }).withMessage('1-10000 arasında alıcı olmalı')
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

    // Toplu SMS gönder
    const result = await smsService.sendBulkSMS(userId, {
      title,
      text,
      recipients,
      reportEnabled: report
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('API Toplu SMS gönderim hatası:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Toplu SMS gönderilirken hata oluştu'
    });
  }
});

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
      totalRecipients: updatedCampaign.totalRecipients,
      successfulSends: updatedCampaign.successfulSends,
      failedSends: updatedCampaign.failedSends,
      status: updatedCampaign.status,
      cost: parseFloat(updatedCampaign.cost).toFixed(2),
      createdAt: updatedCampaign.createdAt,
      messages: updatedCampaign.messages.map(msg => ({
        phoneNumber: msg.phoneNumber,
        status: msg.status,
        sentAt: msg.sentAt,
        deliveredAt: msg.deliveredAt,
        errorMessage: msg.errorMessage,
        cost: parseFloat(msg.cost).toFixed(4)
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

// Bakiye sorgulama (API)
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
        balance: parseFloat(user.balance).toFixed(2),
        currency: 'TL'
      }
    });

  } catch (error) {
    console.error('API Bakiye sorgulama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Bakiye sorgulanırken hata oluştu'
    });
  }
});

// SMS maliyet hesaplama (API)
router.post('/calculate-cost', [
  body('text').isLength({ min: 1, max: 160 }).withMessage('Mesaj 1-160 karakter arası olmalı'),
  body('recipient_count').isInt({ min: 1 }).withMessage('Alıcı sayısı pozitif sayı olmalı')
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

    const { text, recipient_count } = req.body;

    const costInfo = smsService.calculateSMSCost(text, recipient_count);

    res.json({
      success: true,
      data: {
        messageLength: text.length,
        messageCount: costInfo.messageCount,
        recipientCount: recipient_count,
        perSMSCost: parseFloat(costInfo.perSMS).toFixed(4),
        totalCost: parseFloat(costInfo.totalCost).toFixed(2),
        currency: 'TL'
      }
    });

  } catch (error) {
    console.error('API Maliyet hesaplama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Maliyet hesaplanırken hata oluştu'
    });
  }
});

// API kullanım istatistikleri
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { SMSCampaign, SMSMessage } = require('../models');
    const { Op } = require('sequelize');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

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

    const monthSMS = await SMSMessage.count({
      where: { createdAt: { [Op.gte]: startOfMonth } },
      include: [{
        model: SMSCampaign,
        as: 'campaign',
        where: { userId }
      }]
    });

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

    res.json({
      success: true,
      data: {
        totalSMS,
        todaySMS,
        monthSMS,
        deliveredSMS,
        failedSMS,
        successRate: totalSMS > 0 ? ((deliveredSMS / totalSMS) * 100).toFixed(2) : 0,
        failureRate: totalSMS > 0 ? ((failedSMS / totalSMS) * 100).toFixed(2) : 0
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

module.exports = router;