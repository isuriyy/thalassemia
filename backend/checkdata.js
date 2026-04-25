require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  
  const user = await db.collection('users').findOne({ email: 'test@thalademo.com' });
  console.log('Demo user _id:', user._id.toString());
  
  const count = await db.collection('predictions').countDocuments({ userId: user._id });
  console.log('Predictions for this user:', count);
  
  await mongoose.disconnect();
}
check().catch(console.error);