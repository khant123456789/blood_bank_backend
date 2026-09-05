// config/db.js

const mongoose = require('mongoose');

class Database {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.isConnected = false;
    this.listenersAttached = false;
  }

  async connect() {
    // ✅ ပြီးသား connection ရှိရင် ပြန်သုံးမယ်
    if (this.connection && mongoose.connection.readyState === 1) {
      return this.connection;
    }

    // ✅ တစ်ချိန်ထဲ connection လုပ်နေရင် စောင့်မယ်
    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (mongoose.connection.readyState === 1) {
            clearInterval(checkInterval);
            resolve(this.connection);
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    try {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        throw new Error('MongoDB URI is not defined in .env file');
      }

      console.log('🔄 Connecting to MongoDB...');

      // ✅ MongoDB ကို ချိတ်ဆက်မယ်
      const conn = await mongoose.connect(uri, {
        maxPoolSize: 20,
        minPoolSize: 5,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 30000,
        family: 4,
        retryWrites: true,
        w: 'majority',
        retryReads: true,
      });

      // ✅ connection ကို သိမ်းမယ်
      this.connection = conn;
      this.isConnecting = false;
      this.retryCount = 0;
      this.isConnected = true;

      console.log('✅ MongoDB connected successfully');
      console.log(`📊 Database: ${conn.connection.db.databaseName}`);
      console.log(`🔗 Host: ${conn.connection.host}`);

      this._attachEventListeners();

      return this.connection;

    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      console.error('❌ MongoDB connection failed:', error.message);
      
      // ✅ အလိုအလျောက် ပြန်ကြိုးစားမယ်
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        console.log(`🔄 Retrying connection in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect();
      }
      
      throw error;
    }
  }

  _attachEventListeners() {
    if (this.listenersAttached) return;
    
    // ✅ ရှိပြီးသား listeners တွေကို ရှင်းမယ်
    mongoose.connection.removeAllListeners('error');
    mongoose.connection.removeAllListeners('disconnected');
    mongoose.connection.removeAllListeners('reconnected');
    mongoose.connection.removeAllListeners('connected');

    // ✅ Error event
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

    // ✅ Disconnected event
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
      this.isConnected = false;
      this._handleDisconnect();
    });

    // ✅ Reconnected event
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
      this.isConnected = true;
      this.retryCount = 0;
    });

    // ✅ Connected event
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected');
      this.isConnected = true;
    });

    this.listenersAttached = true;
  }

  async _handleDisconnect() {
    if (this.isConnected) return;
    
    if (this.retryCount >= this.maxRetries) {
      console.error('❌ Max retries reached. Please check MongoDB server.');
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message);
    }
  }

  async disconnect() {
    if (this.connection) {
      this.isConnected = false;
      await mongoose.disconnect();
      this.connection = null;
      console.log('🔌 MongoDB disconnected gracefully');
    }
  }

  getStatus() {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    return {
      readyState: state,
      status: states[state] || 'unknown',
      isConnected: this.isConnected,
      retryCount: this.retryCount
    };
  }
}

module.exports = new Database();