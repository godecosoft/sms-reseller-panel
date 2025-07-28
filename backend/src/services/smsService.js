// src/services/smsService.js - TEK API + GİRİLEN NUMARA BAŞI KREDİ SİSTEMİ
const axios = require('axios');
const { SMSCampaign, SMSMessage, User, BalanceTransaction } = require('../models');

class SMSService {
  constructor() {
    this.apiKey = process.env.TURKEYSMS_API_KEY || '1ab9810ca3fb3f871dc130176019ee14';
    this.baseURL = process.env.TURKEYSMS_BASE_URL || 'https://turkeysms.com.tr';
    this.defaultTitle = process.env.DEFAULT_SMS_TITLE || '08509449683';

    // Sadece BULK endpoint kullanılacak
    this.SMS_ENDPOINT = '/api/v3/gruba-gonder/post/tek-metin-gonderimi';
    this.REPORT_ENDPOINT = '/api/v3/rapor/temel';
    
    // Rapor güncelleme sistemi
    this.startReportUpdateService();
  }

  // Telefon numarası formatını kontrol et
  validatePhoneNumber(phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    const phoneRegex = /^90[0-9]{10}$/;
    
    if (!phoneRegex.test(cleanPhone)) {
      throw new Error(`Geçersiz telefon numarası formatı: ${phoneNumber}. Format: 90XXXXXXXXXX`);
    }
    
    return cleanPhone;
  }

  // Kullanıcının SMS title'ını al
  async getUserSMSTitle(user) {
    return user.smsTitle || this.defaultTitle;
  }

  // Kullanıcının API key'ini al
  async getUserAPIKey(user) {
    return user.smsApiKey || this.apiKey;
  }

  // API çağrısı yapma fonksiyonu
  async makeAPICall(endpoint, data, timeout = 60000) {
    try {
      console.log(`🔄 TurkeySMS API çağrısı: ${this.baseURL}${endpoint}`);
      
      const response = await axios.post(
        `${this.baseURL}${endpoint}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'SMS-Reseller-Panel/1.0'
          },
          responseType: 'json',
          timeout,
          validateStatus: (status) => status < 500
        }
      );

      console.log(`📥 API Response Status: ${response.status}`);
      console.log(`📥 API Response Data:`, response.data);

      if (!response.data) {
        throw new Error('TurkeySMS API\'den boş yanıt alındı');
      }

      return response;

    } catch (error) {
      console.error('❌ TurkeySMS API Error:', {
        message: error.message,
        endpoint,
        status: error.response?.status,
        data: error.response?.data,
        timeout: error.code === 'ECONNABORTED'
      });

      if (error.code === 'ECONNABORTED') {
        throw new Error('SMS API zaman aşımı - lütfen tekrar deneyin');
      }

      if (error.code === 'ECONNREFUSED') {
        throw new Error('SMS API\'ye bağlanılamıyor - servis geçici olarak kullanılamıyor');
      }

      if (error.response?.status === 401) {
        throw new Error('SMS API key geçersiz - lütfen API key\'inizi kontrol edin');
      }

      if (error.response?.status === 403) {
        throw new Error('SMS API erişim reddedildi - yetkinizi kontrol edin');
      }

      if (error.response?.status >= 500) {
        throw new Error('SMS API sunucu hatası - lütfen daha sonra tekrar deneyin');
      }

      if (error.response?.data?.result_message) {
        throw new Error(`SMS API Hatası: ${error.response.data.result_message}`);
      }

      if (error.response?.data?.message) {
        throw new Error(`SMS API Hatası: ${error.response.data.message}`);
      }

      throw new Error(`SMS API çağrısı başarısız: ${error.message}`);
    }
  }

  // TurkeySMS yanıt doğrulama
  validateSMSResponse(response, operationType = 'SMS') {
    const data = response.data;

    if (!data || typeof data !== 'object') {
      throw new Error('TurkeySMS API\'den geçersiz yanıt formatı');
    }

    if (!data.hasOwnProperty('result')) {
      throw new Error('TurkeySMS API yanıtında result field bulunamadı');
    }

    const resultCode = Number(data.result);
    const isSuccess = resultCode === 1;

    if (!isSuccess) {
      const errorMessage = data.result_message || 
                          data.message || 
                          `${operationType} işlemi başarısız (Kod: ${resultCode})`;
      throw new Error(errorMessage);
    }

    if (operationType === 'SMS' && !data.rapor_id) {
      console.warn('⚠️ TurkeySMS yanıtında rapor_id bulunamadı');
    }

    return {
      success: true,
      reportId: data.rapor_id,
      resultCode: data.result_code,
      totalNumbers: data.total_mobile_num,
      smsCount: data.number_of_sms,
      rawData: data
    };
  }

  // TEK SMS GÖNDERİM FONKSİYONU - ARTIK SADECE BULK API KULLANIR
  async sendSMS(userId, data) {
    let campaign = null;
    let smsMessages = [];

    try {
      const { title, text, recipients, reportEnabled = true } = data;
      
      // Kullanıcı kontrolü
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Mesaj uzunluğu kontrolü - MAKSIMUM 149 KARAKTER
      if (!text || text.length === 0) {
        throw new Error('Mesaj metni boş olamaz');
      }

      if (text.length > 149) {
        throw new Error('Mesaj metni maksimum 149 karakter olabilir');
      }

      // Recipients array'e dönüştür (tek numara veya çoklu)
      let recipientList = [];
      if (Array.isArray(recipients)) {
        recipientList = recipients;
      } else if (typeof recipients === 'string') {
        recipientList = [recipients];
      } else {
        throw new Error('Geçersiz alıcı format');
      }

      // Maksimum numara kontrolü - 100.000 NUMARA
      if (recipientList.length > 100000) {
        throw new Error('Maksimum 100.000 numara gönderilebilir');
      }

      if (recipientList.length === 0) {
        throw new Error('En az bir telefon numarası gerekli');
      }

      // Telefon numaralarını doğrula
      const validRecipients = [];
      const invalidNumbers = [];
      
      for (const num of recipientList) {
        try {
          const cleanPhone = this.validatePhoneNumber(num);
          validRecipients.push(cleanPhone);
        } catch (error) {
          invalidNumbers.push(num);
          console.warn(`⚠️ Geçersiz numara atlandı: ${num}`);
        }
      }
      
      if (validRecipients.length === 0) {
        throw new Error('Geçerli telefon numarası bulunamadı');
      }

      // YENİ KREDİ SİSTEMİ: GİRİLEN NUMARA BAŞINA KREDİ DÜŞER
      const totalInputNumbers = recipientList.length; // Girilen tüm numaralar
      const requiredCredits = totalInputNumbers; // Her girilen numara için 1 kredi
      const currentBalance = parseFloat(user.balance);
      
      if (currentBalance < requiredCredits) {
        throw new Error(`Yetersiz kredi. ${totalInputNumbers} numara için ${requiredCredits} kredi gerekli. Mevcut: ${Math.floor(currentBalance)} kredi`);
      }

      // SMS başlığı ve API key
      const smsTitle = await this.getUserSMSTitle(user);
      const apiKey = await this.getUserAPIKey(user);

      // Kampanya oluştur
      campaign = await SMSCampaign.create({
        userId,
        title: title || `SMS Gönderimi - ${validRecipients.length} alıcı`,
        messageText: text,
        totalRecipients: totalInputNumbers, // Girilen numara sayısı
        cost: requiredCredits,
        status: 'sending'
      });

      // SMS mesajları oluştur - HER GİRİLEN NUMARA İÇİN
      smsMessages = await Promise.all(
        recipientList.map((phoneNumber, index) => {
          const isValid = validRecipients.includes(phoneNumber.replace(/\s+/g, ''));
          return SMSMessage.create({
            campaignId: campaign.id,
            phoneNumber: phoneNumber.replace(/\s+/g, ''),
            messageText: text,
            cost: 1, // Her numara için 1 kredi
            status: isValid ? 'pending' : 'failed',
            errorMessage: isValid ? null : 'Geçersiz numara formatı'
          });
        })
      );

      // Krediyi düş - GİRİLEN NUMARA SAYISI KADAR
      await user.update({ 
        balance: currentBalance - requiredCredits 
      });
      
      // İşlem kaydı oluştur
      await BalanceTransaction.create({
        userId,
        transactionType: 'debit',
        amount: requiredCredits,
        description: `SMS gönderimi - ${totalInputNumbers} numara (${validRecipients.length} geçerli, ${invalidNumbers.length} geçersiz)`,
        referenceId: campaign.id
      });

      // Eğer geçerli numara yoksa burada dur
      if (validRecipients.length === 0) {
        await campaign.update({
          status: 'failed',
          failedSends: totalInputNumbers
        });

        return {
          success: false,
          message: 'Tüm numaralar geçersiz format',
          campaignId: campaign.id,
          totalInput: totalInputNumbers,
          validNumbers: 0,
          invalidNumbers: invalidNumbers,
          creditsUsed: requiredCredits
        };
      }

      // API verilerini hazırla - SADECE GEÇERLİ NUMARALAR
      const apiData = {
        api_key: apiKey,
        title: smsTitle,
        text,
        sentto: validRecipients,
        report: reportEnabled ? 1 : 0,
        sms_lang: 1,
        response_type: 'json'
      };

      console.log('🚀 SMS API çağrısı başlıyor:', {
        totalInput: totalInputNumbers,
        validRecipients: validRecipients.length,
        invalidCount: invalidNumbers.length,
        title: smsTitle,
        messageLength: text.length,
        creditsUsed: requiredCredits
      });

      // API çağrısı yap
      const response = await this.makeAPICall(this.SMS_ENDPOINT, apiData);
      
      // Yanıtı doğrula
      const validatedResponse = this.validateSMSResponse(response, 'SMS');

      // Başarılı gönderim işlemleri - SADECE GEÇERLİ NUMARALAR
      const validMessageIds = [];
      await Promise.all(
        smsMessages.map(async (msg) => {
          if (validRecipients.includes(msg.phoneNumber)) {
            await msg.update({
              status: 'sent',
              sentAt: new Date(),
              deliveryReportId: validatedResponse.reportId
            });
            validMessageIds.push(msg.id);
          }
        })
      );
      
      await campaign.update({
        status: 'sending',
        successfulSends: validRecipients.length,
        failedSends: invalidNumbers.length,
        reportId: validatedResponse.reportId,
        lastReportCheck: new Date()
      });

      // İlk rapor güncellemesini 2 dakika sonra başlat
      if (validatedResponse.reportId) {
        setTimeout(() => this.updateCampaignReport(campaign.id), 120000);
      }

      console.log('✅ SMS başarıyla gönderildi:', {
        campaignId: campaign.id,
        totalInput: totalInputNumbers,
        validSent: validRecipients.length,
        invalidCount: invalidNumbers.length,
        reportId: validatedResponse.reportId,
        creditsUsed: requiredCredits
      });

      return {
        success: true,
        message: `SMS gönderimi tamamlandı`,
        campaignId: campaign.id,
        totalInput: totalInputNumbers,
        validSent: validRecipients.length,
        invalidNumbers,
        creditsUsed: requiredCredits,
        reportId: validatedResponse.reportId,
        resultCode: validatedResponse.resultCode,
        details: {
          totalNumbers: validatedResponse.totalNumbers,
          smsCount: validatedResponse.smsCount,
          messageLength: text.length
        }
      };

    } catch (apiError) {
      console.error('❌ SMS gönderim hatası:', apiError.message);
      
      // Hata durumunda mesaj durumlarını güncelle
      if (smsMessages.length > 0) {
        await Promise.all(
          smsMessages.map(msg =>
            msg.update({
              status: 'failed',
              errorMessage: apiError.message
            })
          )
        );
      }
      
      if (campaign) {
        await campaign.update({
          status: 'failed',
          failedSends: recipientList?.length || 0
        });
      }
      
      throw new Error(`SMS gönderim hatası: ${apiError.message}`);
    }
  }

  // TurkeySMS rapor sorgulama
  async getDeliveryReport(reportId, apiKey = null) {
    try {
      if (!reportId) {
        throw new Error('Rapor ID bulunamadı');
      }

      const requestData = {
        api_key: apiKey || this.apiKey,
        raporid: reportId,
        response_type: 'json'
      };

      console.log('🔍 TurkeySMS Rapor Sorgulama:', { 
        reportId, 
        url: `${this.baseURL}${this.REPORT_ENDPOINT}` 
      });

      const response = await this.makeAPICall(this.REPORT_ENDPOINT, requestData, 15000);
      
      if (!response.data || !response.data.result) {
        console.warn(`⚠️ Rapor ${reportId} için veri bulunamadı`);
        return null;
      }

      console.log('📊 TurkeySMS Rapor Response:', response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Rapor sorgulama hatası:', error.message);
      return null;
    }
  }

  // Kampanya raporunu güncelle
  async updateCampaignReport(campaignId) {
    try {
      const campaign = await SMSCampaign.findByPk(campaignId, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['smsApiKey']
        }]
      });

      if (!campaign) {
        console.log(`⚠️ Kampanya ${campaignId} bulunamadı`);
        return;
      }

      if (!campaign.reportId) {
        console.log(`⚠️ Kampanya ${campaignId} için rapor ID bulunamadı`);
        return;
      }

      if (campaign.status === 'completed' || campaign.status === 'failed') {
        console.log(`ℹ️ Kampanya ${campaignId} zaten tamamlanmış (${campaign.status})`);
        return;
      }

      const userApiKey = campaign.user?.smsApiKey;
      const report = await this.getDeliveryReport(campaign.reportId, userApiKey);

      if (!report || !report.result) {
        console.log(`⚠️ Kampanya ${campaignId} için rapor alınamadı`);
        return;
      }

      // Rapor verilerini parse et
      const deliveredCount = parseInt(report.numbers_received) || 0;
      const failedCount = parseInt(report.numbers_not_received) || 0;
      const invalidCount = parseInt(report.invalid_numbers) || 0;
      const blockedCount = parseInt(report.blocked_numbers) || 0;
      const totalProcessed = deliveredCount + failedCount + invalidCount + blockedCount;

      // Operatör bilgileri
      const turkcellCount = parseInt(report.turkcell_numbers) || 0;
      const vodafoneCount = parseInt(report.vodafone_numbers) || 0;
      const turktelekomCount = parseInt(report.turktelekom_numbers) || 0;

      console.log(`📊 Kampanya ${campaignId} rapor bilgileri:`, {
        totalRecipients: campaign.totalRecipients,
        totalProcessed,
        delivered: deliveredCount,
        failed: failedCount,
        invalid: invalidCount,
        blocked: blockedCount
      });

      // Rapor bilgilerini güncelle
      const updateData = {
        lastReportCheck: new Date(),
        reportData: JSON.stringify(report),
        deliveredCount,
        failedCount,
        invalidCount,
        blockedCount,
        turkcellCount,
        vodafoneCount,
        turktelekomCount
      };

      // Rapor tamamlanma kontrolü
      const completionThreshold = Math.max(1, Math.floor(campaign.successfulSends * 0.95));
      const isReportComplete = totalProcessed >= completionThreshold;
      
      if (isReportComplete) {
        updateData.status = 'completed';
        console.log(`✅ Kampanya ${campaignId} raporu TAMAMLANDI`);
      } else {
        updateData.status = 'sending';
        console.log(`🔄 Kampanya ${campaignId} raporu DEVAM EDİYOR`);
      }

      await campaign.update(updateData);

      // Eğer rapor tamamlanmadıysa tekrar kontrol et
      const campaignAge = Date.now() - new Date(campaign.createdAt).getTime();
      const oneDay = 24 * 60 * 60 * 1000;
      const fiveMinutes = 5 * 60 * 1000;
      
      if (!isReportComplete && campaignAge < oneDay) {
        setTimeout(() => this.updateCampaignReport(campaignId), fiveMinutes);
        console.log(`⏱️ Kampanya ${campaignId} - 5 dakika sonra tekrar kontrol edilecek`);
      }

      return updateData;

    } catch (error) {
      console.error(`❌ Kampanya ${campaignId} rapor güncelleme hatası:`, error.message);
      return null;
    }
  }

  // Otomatik rapor güncelleme servisi
  startReportUpdateService() {
    const intervalMs = 2 * 60 * 1000; // 2 dakika
    
    setInterval(async () => {
      try {
        console.log('🔄 Otomatik rapor güncelleme başlatılıyor...');
        
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const pendingCampaigns = await SMSCampaign.findAll({
          where: {
            status: 'sending',
            reportId: { [require('sequelize').Op.ne]: null },
            createdAt: { [require('sequelize').Op.gte]: twoDaysAgo }
          },
          include: [{
            model: User,
            as: 'user',
            attributes: ['smsApiKey']
          }],
          order: [['createdAt', 'DESC']],
          limit: 10
        });

        if (pendingCampaigns.length === 0) {
          console.log('ℹ️ Güncellenecek aktif kampanya bulunamadı');
          return;
        }

        console.log(`📊 ${pendingCampaigns.length} kampanya raporu güncellenecek`);

        for (const campaign of pendingCampaigns) {
          try {
            await this.updateCampaignReport(campaign.id);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`❌ Kampanya ${campaign.id} güncelleme hatası:`, error.message);
          }
        }

        console.log('✅ Otomatik rapor güncelleme tamamlandı');

      } catch (error) {
        console.error('❌ Otomatik rapor güncelleme genel hatası:', error.message);
      }
    }, intervalMs);

    console.log(`✅ Otomatik rapor güncelleme servisi başlatıldı (${intervalMs/1000} saniyede bir)`);
  }

  // Test SMS gönderimi
  async sendTestSMS(phoneNumber, message = 'Test mesajı - TurkeySMS API çalışıyor!') {
    try {
      // Telefon numarası doğrulama
      const cleanPhone = this.validatePhoneNumber(phoneNumber);

      const apiData = {
        api_key: this.apiKey,
        title: this.defaultTitle,
        text: message,
        sentto: [cleanPhone],
        report: 1,
        sms_lang: 1,
        response_type: 'json'
      };

      console.log('🧪 Test SMS Gönderimi başlıyor:', {
        phoneNumber: cleanPhone,
        message,
        title: this.defaultTitle
      });

      const response = await this.makeAPICall(this.SMS_ENDPOINT, apiData);
      const validatedResponse = this.validateSMSResponse(response, 'Test SMS');

      console.log('✅ Test SMS başarıyla gönderildi:', validatedResponse);

      return {
        success: true,
        data: validatedResponse.rawData,
        message: 'Test SMS başarıyla gönderildi',
        reportId: validatedResponse.reportId
      };

    } catch (error) {
      console.error('❌ Test SMS Hatası:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Servis durumu kontrolü
  async checkServiceHealth() {
    try {
      const testResult = await this.sendTestSMS('905551234567', 'Health Check');
      return {
        status: 'healthy',
        apiConnection: true,
        lastCheck: new Date().toISOString(),
        testResult
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        apiConnection: false,
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = new SMSService();