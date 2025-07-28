// src/services/smsService.js
const axios = require('axios');
const { SMSCampaign, SMSMessage, User, BalanceTransaction } = require('../models');

class SMSService {
  constructor() {
    this.apiKey = process.env.TURKEYSMS_API_KEY || '1ab9810ca3fb3f871dc130176019ee14';
    this.baseURL = process.env.TURKEYSMS_BASE_URL || 'https://turkeysms.com.tr';
    this.defaultTitle = process.env.DEFAULT_SMS_TITLE || '08509449683';

    // Endpoints
    this.SINGLE_ENDPOINT = '/api/v3/gonder/add-content';
    this.BULK_ENDPOINT   = '/api/v3/gruba-gonder/post/tek-metin-gonderimi';
  }

  // SMS maliyet hesaplama
  calculateSMSCost(messageText, recipientCount) {
    const messageLength = messageText.length;
    const baseCost = 0.01; // 1 kuruş per SMS (sizin fiyatınıza göre ayarlayın)
    const lengthMultiplier = Math.ceil(messageLength / 160);
    const totalCost = recipientCount * baseCost * lengthMultiplier;
    
    return {
      perSMS: baseCost * lengthMultiplier,
      totalCost,
      messageCount: lengthMultiplier
    };
  }

  // Telefon numarası formatını kontrol et
  validatePhoneNumber(phoneNumber) {
    // Türkiye telefon numarası formatı: 90XXXXXXXXXX
    const phoneRegex = /^90[0-9]{10}$/;
    return phoneRegex.test(phoneNumber.replace(/\s+/g, ''));
  }

  // Kullanıcının SMS title'ını al
  async getUserSMSTitle(user) {
    return user.smsTitle || this.defaultTitle;
  }

  // Kullanıcının API key'ini al
  async getUserAPIKey(user) {
    return user.smsApiKey || this.apiKey;
  }

  // Tekli SMS gönderimi
  async sendSingleSMS(userId, data) {
    try {
      const { title, text, recipient, reportEnabled = true } = data;
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Kullanıcı bulunamadı');

      const cleanPhone = recipient.replace(/\s+/g, '');
      if (!this.validatePhoneNumber(cleanPhone)) {
        throw new Error('Geçersiz telefon numarası formatı. Format: 90XXXXXXXXXX');
      }

      const costInfo = this.calculateSMSCost(text, 1);
      if (user.balance < costInfo.totalCost) {
        throw new Error('Yetersiz bakiye');
      }

      const smsTitle = await this.getUserSMSTitle(user);
      const apiKey   = await this.getUserAPIKey(user);

      const campaign = await SMSCampaign.create({
        userId,
        title: title || 'Tekli SMS',
        messageText: text,
        totalRecipients: 1,
        cost: costInfo.totalCost,
        status: 'sending'
      });

      const smsMessage = await SMSMessage.create({
        campaignId: campaign.id,
        phoneNumber: cleanPhone,
        messageText: text,
        cost: costInfo.perSMS,
        status: 'pending'
      });

      const apiData = {
        api_key: apiKey,
        title: smsTitle,
        text,
        sentto: [cleanPhone],
        report: 1,
        sms_lang: 1,
        response_type: 'json'
      };

      console.log('🚀 TurkeySMS Single API Request:', {
        url: `${this.baseURL}${this.SINGLE_ENDPOINT}`,
        data: { ...apiData, api_key: apiKey.substring(0, 8) + '...' }
      });

      const response = await axios.post(
        `${this.baseURL}${this.SINGLE_ENDPOINT}`,
        apiData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          responseType: 'json',
          timeout: 30000
        }
      );

      console.log('📥 TurkeySMS Single API Response:', response.data);

      const resultCode = response.data.result;
      if (response.data && Number(resultCode) === 1) {
        await smsMessage.update({
          status: 'sent',
          sentAt: new Date(),
          deliveryReportId: response.data.rapor_id || null
        });
        await campaign.update({
          status: 'completed',
          successfulSends: 1
        });
        await user.update({ balance: parseFloat(user.balance) - costInfo.totalCost });
        await BalanceTransaction.create({
          userId,
          transactionType: 'debit',
          amount: costInfo.totalCost,
          description: `SMS gönderimi - ${cleanPhone}`,
          referenceId: campaign.id
        });

        return {
          success: true,
          message: 'SMS başarıyla gönderildi',
          campaignId: campaign.id,
          messageId: smsMessage.id,
          cost: costInfo.totalCost,
          reportId: response.data.rapor_id,
          resultCode: response.data.result_code,
          totalNumbers: response.data.total_mobile_num,
          smsCount: response.data.number_of_sms
        };
      } else {
        throw new Error(response.data.result_message || 'SMS gönderim hatası');
      }

    } catch (apiError) {
      console.error('❌ TurkeySMS Single API Error Details:', {
        url: apiError.config?.url,
        status: apiError.response?.status,
        data: apiError.response?.data || apiError.message
      });
      // Update records on failure
      await SMSMessage.update(
        { status: 'failed', errorMessage: apiError.response?.data?.result_message || apiError.message },
        { where: { /* campaign/message identifiers */ } }
      );
      await SMSCampaign.update(
        { status: 'failed', failedSends: 1 },
        { where: { /* campaign id */ } }
      );
      throw new Error(`SMS gönderim hatası: ${apiError.response?.data?.result_message || apiError.message}`);
    }
  }

  // Toplu SMS gönderimi
  async sendBulkSMS(userId, data) {
    try {
      const { title, text, recipients, reportEnabled = true } = data;
      const user = await User.findByPk(userId);
      if (!user) throw new Error('Kullanıcı bulunamadı');

      const validRecipients = [];
      const invalidNumbers = [];
      recipients.forEach(num => {
        const clean = num.replace(/\s+/g, '');
        this.validatePhoneNumber(clean)
          ? validRecipients.push(clean)
          : invalidNumbers.push(num);
      });
      if (!validRecipients.length) {
        throw new Error('Geçerli telefon numarası bulunamadı');
      }

      const costInfo = this.calculateSMSCost(text, validRecipients.length);
      if (user.balance < costInfo.totalCost) {
        throw new Error(`Yetersiz bakiye. Gerekli: ${costInfo.totalCost} TL, Mevcut: ${user.balance} TL`);
      }

      const smsTitle = await this.getUserSMSTitle(user);
      const apiKey   = await this.getUserAPIKey(user);

      const campaign = await SMSCampaign.create({
        userId,
        title: title || 'Toplu SMS',
        messageText: text,
        totalRecipients: validRecipients.length,
        cost: costInfo.totalCost,
        status: 'sending'
      });

      const smsMessages = await Promise.all(
        validRecipients.map(phoneNumber =>
          SMSMessage.create({
            campaignId: campaign.id,
            phoneNumber,
            messageText: text,
            cost: costInfo.perSMS,
            status: 'pending'
          })
        )
      );

      const apiData = {
        api_key: apiKey,
        title: smsTitle,
        text,
        sentto: validRecipients,
        report: 1,
        sms_lang: 1,
        response_type: 'json'
      };

      console.log('🚀 TurkeySMS Bulk API Request:', {
        url: `${this.baseURL}${this.BULK_ENDPOINT}`,
        recipientCount: validRecipients.length,
        data: { ...apiData, api_key: apiKey.substring(0, 8) + '...' }
      });

      const response = await axios.post(
        `${this.baseURL}${this.BULK_ENDPOINT}`,
        apiData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          responseType: 'json',
          timeout: 60000
        }
      );

      console.log('📥 TurkeySMS Bulk API Response:', response.data);

      if (response.data && Number(response.data.result) === 1) {
        await Promise.all(
          smsMessages.map(msg =>
            msg.update({
              status: 'sent',
              sentAt: new Date(),
              deliveryReportId: response.data.rapor_id || null
            })
          )
        );
        await campaign.update({
          status: 'completed',
          successfulSends: validRecipients.length
        });
        await user.update({ balance: parseFloat(user.balance) - costInfo.totalCost });
        await BalanceTransaction.create({
          userId,
          transactionType: 'debit',
          amount: costInfo.totalCost,
          description: `Toplu SMS gönderimi - ${validRecipients.length} alıcı`,
          referenceId: campaign.id
        });

        return {
          success: true,
          message: 'SMS\'ler başarıyla gönderildi',
          campaignId: campaign.id,
          totalSent: validRecipients.length,
          invalidNumbers,
          cost: costInfo.totalCost,
          reportId: response.data.rapor_id,
          resultCode: response.data.result_code,
          totalNumbers: response.data.total_mobile_num,
          smsCount: response.data.number_of_sms
        };
      } else {
        throw new Error(response.data.result_message || 'Toplu SMS gönderim hatası');
      }

    } catch (apiError) {
      console.error('❌ TurkeySMS Bulk API Error Details:', {
        url: apiError.config?.url,
        status: apiError.response?.status,
        data: apiError.response?.data || apiError.message
      });
      // Mark all messages as failed
      await Promise.all(
        apiError.campaignId
          ? smsMessages.map(msg =>
              msg.update({
                status: 'failed',
                errorMessage: apiError.response?.data?.result_message || apiError.message
              })
            )
          : []
      );
      await SMSCampaign.update(
        { status: 'failed', failedSends: validRecipients.length },
        { where: { id: apiError.campaignId || campaign.id } }
      );
      throw new Error(`Toplu SMS gönderim hatası: ${apiError.response?.data?.result_message || apiError.message}`);
    }
  }

  // Delivery raporu alma
  async getDeliveryReport(reportId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v3/rapor/get/${reportId}`,
        {
          params: {
            api_key: this.apiKey,
            response_type: 'json'
          },
          headers: {
            'Accept': 'application/json'
          },
          responseType: 'json',
          timeout: 10000
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Delivery raporu alma hatası:', error);
      throw new Error('Delivery raporu alınamadı');
    }
  }

  // Test SMS gönderimi
  async sendTestSMS(phoneNumber, message = 'Test mesajı - TurkeySMS API çalışıyor!') {
    try {
      const apiData = {
        api_key: this.apiKey,
        title: this.defaultTitle,
        text: message,
        sentto: [phoneNumber],
        report: 1,
        sms_lang: 1,
        response_type: 'json'
      };

      console.log('🧪 Test SMS Gönderimi:', {
        url: `${this.baseURL}${this.SINGLE_ENDPOINT}`,
        phoneNumber,
        message
      });

      const response = await axios.post(
        `${this.baseURL}${this.SINGLE_ENDPOINT}`,
        apiData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          responseType: 'json',
          timeout: 30000
        }
      );

      console.log('✅ Test SMS Response:', response.data);

      return {
        success: Number(response.data.result) === 1,
        data: response.data,
        message: response.data.result_message || 'Test SMS gönderildi'
      };
    } catch (error) {
      console.error('❌ Test SMS Hatası:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new SMSService();
