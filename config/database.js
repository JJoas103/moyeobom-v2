const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in .env file');
    // Atlas 연결 문자열에 DB 이름이 없으면 'test' DB에 저장됨 → dbName으로 고정
    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'moyeobom' });
    console.log(`MongoDB 연결 성공 (db: ${mongoose.connection.name})`);
  } catch (error) {
    console.error('MongoDB 연결 실패:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
