// diagnose.js — run this to see what's actually in MongoDB
// Command: node diagnose.js
require('dotenv').config();
const mongoose = require('mongoose');

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected\n');

  const db = mongoose.connection.db;

  // List all collections
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  // Show one document from each collection
  for (const col of collections) {
    const doc = await db.collection(col.name).findOne({});
    console.log(`\n--- ${col.name} (sample doc) ---`);
    console.log(JSON.stringify(doc, null, 2));
  }

  await mongoose.disconnect();
}

diagnose().catch(console.error);
