// src/database/init.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { sequelize, User, SMSCampaign, SMSMessage, BalanceTransaction } = require('../models');
require('dotenv').config();

async function initializeDatabase() {
  try {
    console.log('🔄 Veritabanı kurulumu başlıyor...');

    // Veritabanı bağlantısını test et
    await sequelize.authenticate();
    console.log('✅ Veritabanı bağlantısı başarılı');

    // Tabloları oluştur
    await sequelize.sync({ force: false });
    console.log('✅ Veritabanı tabloları oluşturuldu');

    // Admin kullanıcısı var mı kontrol et
    const existingAdmin = await User.findOne({
      where: { role: 'admin' }
    });

    if (!existingAdmin) {
      // Admin kullanıcısı oluştur
      const adminPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || 'admin123',
        12
      );

      const admin = await User.create({
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@smspanel.com',
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        balance: 0.00,
        apiKey: uuidv4(),
        status: 'active'
      });

      console.log('✅ Admin kullanıcısı oluşturuldu');
      console.log(`   Kullanıcı adı: ${admin.username}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Şifre: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
      console.log(`   API Key: ${admin.apiKey}`);
    } else {
      console.log('ℹ️  Admin kullanıcısı zaten mevcut');
    }

    // Demo kullanıcısı oluştur (development için)
    if (process.env.NODE_ENV === 'development') {
      const existingDemo = await User.findOne({
        where: { username: 'demo' }
      });

      if (!existingDemo) {
        const demoPassword = await bcrypt.hash('demo123', 12);
        
        const demoUser = await User.create({
          username: 'demo',
          email: 'demo@smspanel.com',
          password: demoPassword,
          firstName: 'Demo',
          lastName: 'User',
          role: 'user',
          balance: 100.00,
          apiKey: uuidv4(),
          status: 'active'
        });

        // Demo kullanıcısı için bakiye işlemi
        await BalanceTransaction.create({
          userId: demoUser.id,
          transactionType: 'credit',
          amount: 100.00,
          description: 'Demo hesabı başlangıç bakiyesi',
          referenceId: demoUser.id
        });

        console.log('✅ Demo kullanıcısı oluşturuldu');
        console.log(`   Kullanıcı adı: demo`);
        console.log(`   Şifre: demo123`);
        console.log(`   Bakiye: 100.00 TL`);
        console.log(`   API Key: ${demoUser.apiKey}`);
      }
    }

    console.log('🎉 Veritabanı kurulumu tamamlandı!');
    console.log('');
    console.log('📌 Önemli Bilgiler:');
    console.log('   - Admin paneline giriş yapmak için yukarıdaki bilgileri kullanın');
    console.log('   - API kullanımı için API key\'leri kullanabilirsiniz');
    console.log('   - Demo hesabı sadece development ortamında oluşturulur');
    console.log('');

  } catch (error) {
    console.error('❌ Veritabanı kurulum hatası:', error);
    throw error;
  }
}

// Veritabanını sıfırla (development için)
async function resetDatabase() {
  try {
    console.log('⚠️  Veritabanı sıfırlanıyor...');
    
    await sequelize.sync({ force: true });
    console.log('✅ Veritabanı sıfırlandı');
    
    // Kurulumu tekrar çalıştır
    await initializeDatabase();
    
  } catch (error) {
    console.error('❌ Veritabanı sıfırlama hatası:', error);
    throw error;
  }
}

// Örnek veri oluştur (development için)
async function createSampleData() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      console.log('ℹ️  Örnek veriler sadece development ortamında oluşturulur');
      return;
    }

    console.log('📊 Örnek veriler oluşturuluyor...');

    // Demo kullanıcısını bul
    const demoUser = await User.findOne({
      where: { username: 'demo' }
    });

    if (!demoUser) {
      console.log('❌ Demo kullanıcısı bulunamadı');
      return;
    }

    // Örnek SMS kampanyası oluştur
    const sampleCampaign = await SMSCampaign.create({
      userId: demoUser.id,
      title: 'Test Kampanyası',
      messageText: 'Bu bir test mesajıdır. SMS paneli çalışıyor!',
      totalRecipients: 3,
      successfulSends: 2,
      failedSends: 1,
      cost: 0.15,
      status: 'completed'
    });

    // Örnek SMS mesajları oluştur
    const sampleMessages = [
      {
        campaignId: sampleCampaign.id,
        phoneNumber: '905551234567',
        messageText: 'Bu bir test mesajıdır. SMS paneli çalışıyor!',
        status: 'delivered',
        cost: 0.05,
        sentAt: new Date(),
        deliveredAt: new Date()
      },
      {
        campaignId: sampleCampaign.id,
        phoneNumber: '905557654321',
        messageText: 'Bu bir test mesajıdır. SMS paneli çalışıyor!',
        status: 'delivered',
        cost: 0.05,
        sentAt: new Date(),
        deliveredAt: new Date()
      },
      {
        campaignId: sampleCampaign.id,
        phoneNumber: '905559876543',
        messageText: 'Bu bir test mesajıdır. SMS paneli çalışıyor!',
        status: 'failed',
        cost: 0.05,
        sentAt: new Date(),
        errorMessage: 'Geçersiz numara'
      }
    ];

    await SMSMessage.bulkCreate(sampleMessages);

    // Demo kullanıcısı bakiyesinden düş
    await demoUser.update({
      balance: parseFloat(demoUser.balance) - 0.15
    });

    // Bakiye işlemi kaydet
    await BalanceTransaction.create({
      userId: demoUser.id,
      transactionType: 'debit',
      amount: 0.15,
      description: 'Test kampanyası SMS gönderimi',
      referenceId: sampleCampaign.id
    });

    console.log('✅ Örnek veriler oluşturuldu');
    console.log(`   - 1 kampanya (${sampleCampaign.title})`);
    console.log(`   - 3 SMS mesajı (2 başarılı, 1 başarısız)`);
    console.log(`   - Bakiye işlemi kaydı`);

  } catch (error) {
    console.error('❌ Örnek veri oluşturma hatası:', error);
    throw error;
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'init':
        await initializeDatabase();
        break;
      
      case 'reset':
        await resetDatabase();
        break;
      
      case 'sample':
        await createSampleData();
        break;
      
      case 'setup':
        await initializeDatabase();
        await createSampleData();
        break;
      
      default:
        console.log('📋 Kullanılabilir komutlar:');
        console.log('   node src/database/init.js init     - Veritabanını kurulum');
        console.log('   node src/database/init.js reset    - Veritabanını sıfırla');
        console.log('   node src/database/init.js sample   - Örnek veriler oluştur');
        console.log('   node src/database/init.js setup    - Tam kurulum (init + sample)');
        break;
    }
  } catch (error) {
    console.error('💥 Hata:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Script olarak çalıştırılıyorsa
if (require.main === module) {
  main();
}

module.exports = {
  initializeDatabase,
  resetDatabase,
  createSampleData
};