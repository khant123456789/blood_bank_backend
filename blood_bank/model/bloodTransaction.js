// blood_bank/model/bloodTransaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  bloodType: { 
    type: String, 
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], 
    required: true 
  },
  component: { 
    type: String, 
    enum: ['WB', 'PC', 'FFP', 'PRP'], 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  action: { 
    type: String, 
    enum: ['Add', 'Issue', 'Expired'], 
    required: true 
  },
  // ✅ လုပ်ဆောင်သူအချက်အလက်များ
  performedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  // ✅ မှတ်ချက် (Optional)
  remark: {
    type: String,
    trim: true,
    maxlength: 200
  }
}, {
  timestamps: true
});

// ✅ Indexes for better query performance
transactionSchema.index({ performedBy: 1 });
transactionSchema.index({ performedBy: 1, action: 1 });
transactionSchema.index({ date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);