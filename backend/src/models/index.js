// src/models/index.js - User modeline SMS ayarları eklendi
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Kullanıcılar Modeli - SMS AYARLARI EKLENDİ
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user'
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  apiKey: {
    type: DataTypes.STRING(255),
    unique: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  // YENİ SMS AYARLARI
  smsTitle: {
    type: DataTypes.STRING(20),
    defaultValue: '08509449683',
    comment: 'SMS gönderici adı - TurkeySMS title parametresi'
  },
  smsApiKey: {
    type: DataTypes.STRING(255),
    defaultValue: '1ab9810ca3fb3f871dc130176019ee14',
    comment: 'Kullanıcıya özel TurkeySMS API key'
  }
}, {
  tableName: 'users',
  timestamps: true
});

// SMS Kampanyaları Modeli
const SMSCampaign = sequelize.define('SMSCampaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  messageText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  totalRecipients: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  successfulSends: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failedSends: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('pending', 'sending', 'completed', 'failed'),
    defaultValue: 'pending'
  }
}, {
  tableName: 'sms_campaigns',
  timestamps: true
});

// SMS Mesajları Modeli
const SMSMessage = sequelize.define('SMSMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: SMSCampaign,
      key: 'id'
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  messageText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed'),
    defaultValue: 'pending'
  },
  deliveryReportId: {
    type: DataTypes.STRING(100)
  },
  cost: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0.0000
  },
  sentAt: {
    type: DataTypes.DATE
  },
  deliveredAt: {
    type: DataTypes.DATE
  },
  errorMessage: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'sms_messages',
  timestamps: true
});

// Bakiye Hareketleri Modeli
const BalanceTransaction = sequelize.define('BalanceTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  transactionType: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  referenceId: {
    type: DataTypes.UUID
  }
}, {
  tableName: 'balance_transactions',
  timestamps: true
});

// İlişkileri tanımla
User.hasMany(SMSCampaign, { foreignKey: 'userId', as: 'campaigns' });
User.hasMany(BalanceTransaction, { foreignKey: 'userId', as: 'transactions' });

SMSCampaign.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SMSCampaign.hasMany(SMSMessage, { foreignKey: 'campaignId', as: 'messages' });

SMSMessage.belongsTo(SMSCampaign, { foreignKey: 'campaignId', as: 'campaign' });

BalanceTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  SMSCampaign,
  SMSMessage,
  BalanceTransaction
};