const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  bloodType: { 
    type: String, 
    enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], 
    required: true 
  },
  component: { 
    type: String, 
    enum: ['WB', 'PC','FFP','PRP'], 
    required: true 
  },
  currentQty: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  updatedAt: { type: Date, default: Date.now }
});

// Blood Type + Component တွဲပြီး တစ်ခုတည်းသာ ရှိရန်
stockSchema.index({ bloodType: 1, component: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);