// src/services/smsService.js - DÜZELTİLMİŞ VERSİYON
const axios = require('axios');
const { SMSCampaign, SMSMessage, User, BalanceTransaction } = require('../models');

class SMSService {
  constructor() {
    this.apiKey = process.env.TURKEYSMS_API_KEY;
    this.baseURL = process.env.TURKEYSMS_BASE_URL;
  }

  // SMS maliyet hesaplama
  calculateSMSCost(messageText, recipientCount) {
    const messageLength = messageText.length;
    const baseCost = 0.05; // 5 kuruş per SMS
    const lengthMultiplier = Math.ceil(messageLength / 160);
    const totalCost = recipientCount * baseCost * lengthMultiplier;
    
    return {
      perSMS: baseCost * lengthMultiplier,
      totalCost: totalCost,
      messageCount: lengthMultiplier
    };
  }

  // Telefon numarası formatını kontrol et
  validatePhoneNumber(phoneNumber) {
    // Türkiye telefon numarası formatı: 90XXXXXXXXXX
    const phoneRegex = /^90[0-9]{10}$/;
    return phoneRegex.test(phoneNumber.replace(/\s+/g, ''));
  }

  // Tekli SMS gönderimi
  async sendSingleSMS(userId, data) {
    try {
      const { title, text, recipient, reportEnabled = true } = data;

      // Kullanıcıyı bul
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Telefon numarasını doğrula
      const cleanPhoneNumber = recipient.replace(/\s+/g, '');
      if (!this.validatePhoneNumber(cleanPhoneNumber)) {
        throw new Error('Geçersiz telefon numarası formatı');
      }

      // Maliyeti hesapla
      const costInfo = this.calculateSMSCost(text, 1);
      
      // Bakiye kontrolü
      if (user.balance < costInfo.totalCost) {
        throw new Error('Yetersiz bakiye');
      }

      // Kampanya oluştur
      const campaign = await SMSCampaign.create({
        userId: userId,
        title: title || 'Tekli SMS',
        messageText: text,
        totalRecipients: 1,
        cost: costInfo.totalCost,
        status: 'sending'
      });

      // SMS mesajı kaydı oluştur
      const smsMessage = await SMSMessage.create({
        campaignId: campaign.id,
        phoneNumber: cleanPhoneNumber,
        messageText: text,
        cost: costInfo.perSMS,
        status: 'pending'
      });

      try {
        // SMS API'sine istek gönder
        const apiData = {
          api_key: this.apiKey,
          title: title,
          text: text,
          sentto: [cleanPhoneNumber],
          report: reportEnabled ? 1 : 0,
          sms_lang: 1,
          response_type: 'json'
        };

        const response = await axios.post(
          `${this.baseURL}/gruba-gonder/post/tek-metin-gonderimi`,
          apiData,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        // API yanıtını kontrol et
        if (response.data && response.data.status === 'success') {
          // Başarılı gönderim
          await smsMessage.update({
            status: 'sent',
            sentAt: new Date(),
            deliveryReportId: response.data.report_id || null
          });

          await campaign.update({
            status: 'completed',
            successfulSends: 1
          });

          // Bakiyeden düş
          await user.update({
            balance: parseFloat(user.balance) - costInfo.totalCost
          });

          // Bakiye işlemi kaydet
          await BalanceTransaction.create({
            userId: userId,
            transactionType: 'debit',
            amount: costInfo.totalCost,
            description: `SMS gönderimi - ${cleanPhoneNumber}`,
            referenceId: campaign.id
          });

          return {
            success: true,
            message: 'SMS başarıyla gönderildi',
            campaignId: campaign.id,
            messageId: smsMessage.id,
            cost: costInfo.totalCost,
            reportId: response.data.report_id
          };

        } else {
          throw new Error(response.data?.message || 'SMS gönderim hatası');
        }

      } catch (apiError) {
        // API hatası durumunda
        await smsMessage.update({
          status: 'failed',
          errorMessage: apiError.message
        });

        await campaign.update({
          status: 'failed',
          failedSends: 1
        });

        throw new Error(`SMS gönderim hatası: ${apiError.message}`);
      }

    } catch (error) {
      console.error('SMS gönderim hatası:', error);
      throw error;
    }
  }

  // Toplu SMS gönderimi
  async sendBulkSMS(userId, data) {
    try {
      const { title, text, recipients, reportEnabled = true } = data;

      // Kullanıcıyı bul
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Telefon numaralarını doğrula ve temizle
      const validRecipients = [];
      const invalidNumbers = [];

      recipients.forEach(number => {
        const cleanNumber = number.replace(/\s+/g, '');
        if (this.validatePhoneNumber(cleanNumber)) {
          validRecipients.push(cleanNumber);
        } else {
          invalidNumbers.push(number);
        }
      });

      if (validRecipients.length === 0) {
        throw new Error('Geçerli telefon numarası bulunamadı');
      }

      // Maliyeti hesapla
      const costInfo = this.calculateSMSCost(text, validRecipients.length);
      
      // Bakiye kontrolü
      if (user.balance < costInfo.totalCost) {
        throw new Error(`Yetersiz bakiye. Gerekli: ${costInfo.totalCost} TL, Mevcut: ${user.balance} TL`);
      }

      // Kampanya oluştur
      const campaign = await SMSCampaign.create({
        userId: userId,
        title: title || 'Toplu SMS',
        messageText: text,
        totalRecipients: validRecipients.length,
        cost: costInfo.totalCost,
        status: 'sending'
      });

      // SMS mesajları kayıtlarını oluştur
      const smsMessages = await Promise.all(
        validRecipients.map(phoneNumber =>
          SMSMessage.create({
            campaignId: campaign.id,
            phoneNumber: phoneNumber,
            messageText: text,
            cost: costInfo.perSMS,
            status: 'pending'
          })
        )
      );

      try {
        // SMS API'sine istek gönder
        const apiData = {
          api_key: this.apiKey,
          title: title,
          text: text,
          sentto: validRecipients,
          report: reportEnabled ? 1 : 0,
          sms_lang: 1,
          response_type: 'json'
        };

        const response = await axios.post(
          `${this.baseURL}/gruba-gonder/post/tek-metin-gonderimi`,
          apiData,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );

        // API yanıtını kontrol et
        if (response.data && response.data.status === 'success') {
          // Başarılı gönderim
          await Promise.all(
            smsMessages.map(msg =>
              msg.update({
                status: 'sent',
                sentAt: new Date(),
                deliveryReportId: response.data.report_id || null
              })
            )
          );

          await campaign.update({
            status: 'completed',
            successfulSends: validRecipients.length
          });

          // Bakiyeden düş
          await user.update({
            balance: parseFloat(user.balance) - costInfo.totalCost
          });

          // Bakiye işlemi kaydet
          await BalanceTransaction.create({
            userId: userId,
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
            invalidNumbers: invalidNumbers,
            cost: costInfo.totalCost,
            reportId: response.data.report_id
          };

        } else {
          throw new Error(response.data?.message || 'Toplu SMS gönderim hatası');
        }

      } catch (apiError) {
        // API hatası durumunda tüm mesajları failed yap
        await Promise.all(
          smsMessages.map(msg =>
            msg.update({
              status: 'failed',
              errorMessage: apiError.message
            })
          )
        );

        await campaign.update({
          status: 'failed',
          failedSends: validRecipients.length
        });

        throw new Error(`Toplu SMS gönderim hatası: ${apiError.message}`);
      }

    } catch (error) {
      console.error('Toplu SMS gönderim hatası:', error);
      throw error;
    }
  }

  // Delivery raporu alma
  async getDeliveryReport(reportId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/rapor/get/${reportId}`,
        {
          params: {
            api_key: this.apiKey,
            response_type: 'json'
          },
          timeout: 10000
        }
      );

      return response.data;

    } catch (error) {
      console.error('Delivery raporu alma hatası:', error);
      throw new Error('Delivery raporu alınamadı');
    }
  }

  // Kampanya raporu güncelleme
  async updateCampaignReport(campaignId) {
    try {
      const campaign = await SMSCampaign.findByPk(campaignId, {
        include: [{
          model: SMSMessage,
          as: 'messages'
        }]
      });

      if (!campaign) {
        throw new Error('Kampanya bulunamadı');
      }

      // Delivery raporunu al (eğer report ID varsa)
      const reportId = campaign.messages[0]?.deliveryReportId;
      if (reportId) {
        const deliveryReport = await this.getDeliveryReport(reportId);
        
        // Rapor verilerine göre SMS durumlarını güncelle
        if (deliveryReport && deliveryReport.data) {
          // Bu kısım SMS provider'ın rapor formatına göre özelleştirilmeli
          // Örnek güncelleme mantığı
          const reportData = deliveryReport.data;
          
          for (const message of campaign.messages) {
            // Raporda bu numaranın durumunu bul
            const messageReport = reportData.find(r => r.number === message.phoneNumber);
            if (messageReport) {
              await message.update({
                status: messageReport.status === 'delivered' ? 'delivered' : 'failed',
                deliveredAt: messageReport.status === 'delivered' ? new Date() : null,
                errorMessage: messageReport.error || null
              });
            }
          }
        }
      }

      return {
        success: true,
        message: 'Kampanya raporu güncellendi'
      };

    } catch (error) {
      console.error('Kampanya raporu güncelleme hatası:', error);
      throw error;
    }
  }
}

module.exports = new SMSService();