const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  bloodType: { 
    type: String, 
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], 
    required: true 
  },
  component: { 
    type: String, 
    enum: ['Whole Blood', 'Pack Cell', 'FFP','PRP'], 
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
  date: { type: Date, default: Date.now }
  // performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Auth ထည့်ရင် ဒီနေရာမှာ ထည့်ပါမယ်။
});

module.exports = mongoose.model('Transaction', transactionSchema);