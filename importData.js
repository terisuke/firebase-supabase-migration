const admin = require('firebase-admin');
const fs = require('fs');

// Firebase Admin SDKの初期化 (サービスアカウントキーを使用)
const serviceAccount = require('./serviceAccountKey.json'); // サービスアカウントキーのファイル名を指定
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function importData() {
  try {
    // users コレクション
    const usersData = JSON.parse(fs.readFileSync('testData/users.json', 'utf8'));
    for (const [id, user] of Object.entries(usersData)) {
      await db.collection('users').doc(id).set(user);
    }
    console.log('users imported');

    // logs コレクション
    const logsData = JSON.parse(fs.readFileSync('testData/logs.json', 'utf8'));
    for (const [id, log] of Object.entries(logsData)) {
      await db.collection('logs').doc(id).set(log);
    }
    console.log('logs imported');

    // nfc コレクション
    const nfcData = JSON.parse(fs.readFileSync('testData/nfc.json', 'utf8'));
    for (const [id, nfc] of Object.entries(nfcData)) {
      await db.collection('nfc').doc(id).set(nfc);
    }
    console.log('nfc imported');

    // notice コレクション (サブコレクション message を含む)
    const noticeData = JSON.parse(fs.readFileSync('testData/notice.json', 'utf8'));
    for (const [date, notice] of Object.entries(noticeData)) {
      await db.collection('notice').doc(date).set({ timestamp: notice.timestamp }); // ドキュメントを作成
      if (notice.message) {
        for (const [messageId, message] of Object.entries(notice.message)) {
          await db.collection('notice').doc(date).collection('message').doc(messageId).set(message); // サブコレクションにドキュメントを追加
        }
      }
    }
    console.log('notice imported');

    // counters コレクション
    const countersData = JSON.parse(fs.readFileSync('testData/counters.json', 'utf8'));
    for (const [id, counter] of Object.entries(countersData)) {
      await db.collection('counters').doc(id).set(counter);
    }
    console.log('counters imported');

    // foreigner コレクション
    const foreignerData = JSON.parse(fs.readFileSync('testData/foreigner.json', 'utf8'));
    for (const [id, foreigner] of Object.entries(foreignerData)) {
      await db.collection('foreigner').doc(id).set(foreigner);
    }
    console.log('foreigner imported');

  } catch (error) {
    console.error('Error importing data:', error);
  }
}

importData();