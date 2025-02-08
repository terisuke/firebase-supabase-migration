require('dotenv').config();

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Firebase Admin SDKの初期化 (サービスアカウントキーを使用)
const serviceAccount = require('./serviceAccountKey.json'); // サービスアカウントキーのファイル名を指定
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Supabase クライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * 日時文字列をパースして、PostgreSQLに対応した日時形式に変換します。
 * 例:
 *   - "2022年6月15日 3:45:47 UTC+9" -> "2022-06-14T18:45:47.000Z" (UTC)
 *   - "2024年11月21日 16:09:34 UTC+9" -> "2024-11-21T07:09:34.000Z" (UTC)
 *
 * Firestoreでよくみられる "2024/04/02 14:51:00" といった文字列も
 * ここで判定し、適宜処理をカスタマイズしています（例示）。
 */
function parseTimestamp(timestampStr) {
  if (!timestampStr) {
    return null;
  }

  // パターン1: "YYYY/MM/DD HH:mm:ss" 形式 (例: 2024/04/02 14:51:00)
  const pattern1 = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  // パターン2: "YYYY年M月D日 H時m分s秒 UTC±X" 形式 (例: 2022年6月15日 3:45:47 UTC+9)
  const pattern2 = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s+UTC\+?(-?\d{1,2})$/;

  // パターン1でマッチするか
  let match = timestampStr.match(pattern1);
  if (match) {
    const [_, year, month, day, hour, minute, second] = match;
    // Firestoreなどからの書式でタイムゾーン情報が無い場合は UTC+9 相当とみなす or UTC扱い
    // ここでは暫定的に UTC+9（JST相当）として扱う例
    // 実際にはローカルタイムとして解釈するなど、要件に合わせて調整してください。
    const date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour) - 9, // JST->UTC
      parseInt(minute),
      second ? parseInt(second) : 0
    ));
    return date.toISOString(); // UTCに変換したうえでISO文字列
  }

  // パターン2でマッチするか
  match = timestampStr.match(pattern2);
  if (match) {
    const [_, year, month, day, hour, minute, second, utcOffset] = match;
    // "UTC+9" -> +09:00のように扱いたい
    // offsetが正なら - の分だけUTCに近づける、と考えられるため
    // 例: UTC+9 -> 実際のUTCから見ると -9時間
    const offsetNum = parseInt(utcOffset, 10); // +9 or -3 など

    // ここではUTC+Xを内部的に(UTC - Xhours)として取り扱う
    // JST (UTC+9) の場合、date.toISOString()にするときは -9時間してやる必要がある
    const date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour) - offsetNum,
      parseInt(minute),
      second ? parseInt(second) : 0
    ));
    return date.toISOString();
  }

  // どちらでもなければ、Date.parse()に任せるか、あるいはそのまま文字列で返すか
  // ここでは最後の手段としてDate.parse()を使う
  const maybeDate = new Date(timestampStr);
  if (!isNaN(maybeDate.getTime())) {
    return maybeDate.toISOString();
  }

  // パース失敗時は null を返す
  return null;
}

async function migrateData() {
  try {
    // -------------------------
    // users コレクション -> users テーブル
    // -------------------------
    {
      const snapshot = await db.collection('users').get();
      console.log(`Found ${snapshot.size} users in Firestore`);
      for (const doc of snapshot.docs) {
        // Firestore上のdoc.id を id として扱う
        const data = doc.data();

        // timestampはSupabaseには created_at 相当のカラムに突っ込むイメージ?
        // createTables.js では created_at TIMESTAMP WITH TIME ZONE となっている。
        const convertedTimestamp = parseTimestamp(data.timestamp);

        // SupabaseへUPSERT（存在しなければINSERT、存在すればUPDATE）
        // onConflict: 'id' -> 同じidのレコードがあれば上書き
        const { error } = await supabase
          .from('users')
          .upsert({
            id: doc.id, // FirestoreのドキュメントID
            number: data.number,
            name: data.name,
            pronunciation: data.pronunciation,
            email: data.email,
            phone: data.phone,
            address1: data.address1,
            address2: data.address2,
            city: data.city,
            prefecture: data.prefecture,
            belongs: data.belongs,
            job: data.job,
            found: data.found,
            comments: data.comments,
            details: data.details,
            created_at: convertedTimestamp ? convertedTimestamp : null,
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('Error upserting user:', doc.id, error);
        } else {
          console.log('Upserted user:', doc.id);
        }
      }
    }

    // -------------------------
    // logs コレクション -> logs テーブル
    // -------------------------
    {
      const snapshot = await db.collection('logs').get();
      console.log(`Found ${snapshot.size} logs in Firestore`);
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // こちらもFireStoreにおけるdoc.idをPostgres側の主キー (id) として扱う想定
        // date/time等の整形が必要であれば parseTimestamp()を使ったり
        // 'start_time', 'end_time', 'timestamp' カラムを適宜整形する
        const convertedTimestamp = parseTimestamp(data.timestamp);

        // start, end は "15:00" などの文字列が想定されるが、PostgreSQLの TIME カラムに合わせる場合は
        // "15:00:00" のように秒までを付与するか、あるいは casting させるなどの工夫が必要。
        // ここでは単純に末尾に ":00" を付け加える例。
        const start_time = data.start ? `${data.start}:00` : null;
        const end_time = data.end ? `${data.end}:00` : null;

        const { error } = await supabase
          .from('logs')
          .upsert({
            id: doc.id,
            user_id: data.userId, // リレーションのキー
            space: data.space,
            start_time,
            end_time,
            timestamp: convertedTimestamp ? convertedTimestamp : null,
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('Error upserting log:', doc.id, error);
        } else {
          console.log('Upserted log:', doc.id);
        }
      }
    }

    // -------------------------
    // nfc コレクション -> nfc テーブル
    // -------------------------
    {
      const snapshot = await db.collection('nfc').get();
      console.log(`Found ${snapshot.size} nfc items in Firestore`);
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Firestoreでは nfc_id, number などが格納されていた想定？
        // createTables.js では user_number というカラムがあるので
        // Firestoreの「number」を user_number として扱う
        const { error } = await supabase
          .from('nfc')
          .upsert({
            nfc_id: doc.id, // Firestoreのdoc.idをキーとする例
            internal_nfc_id: data.nfc_id ? data.nfc_id : null,
            user_number: data.number ? data.number : null,
          }, {
            onConflict: 'nfc_id',
          });

        if (error) {
          console.error('Error upserting nfc:', doc.id, error);
        } else {
          console.log('Upserted nfc:', doc.id);
        }
      }
    }

    // -------------------------
    // notice コレクション -> notices テーブル
    //
    // Firestoreでは以下のような構造:
    // notice
    //   - docId = YYYY-MM-DD など
    //     - timestamp
    //     - message (サブコレクション)
    //         - docId
    //             text, timestamp, userId
    //
    // Supabaseでは createTables.js の "notices" テーブルに単純に1レコードずつ書き込む設計
    // メッセージ(サブコレクション) をどう扱うか要検討
    // ひとまず最初の1メッセージだけをコピーする例。
    // -------------------------
    {
      const snapshot = await db.collection('notice').get();
      console.log(`Found ${snapshot.size} notice docs in Firestore`);

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // doc.id は "2025-02-05" のような形式の場合あり
        // supabaseのnoticesテーブルには "id", "date", "message", "message_timestamp", "message_user_id" カラム
        // ここではサブコレクションのメッセージを1つだけ抜き出して書き込む例
        let message = null;
        let message_timestamp = null;
        let message_user_id = null;

        const subCollectionRef = db.collection('notice').doc(doc.id).collection('message');
        const subSnap = await subCollectionRef.get();

        // 1つだけ使う例
        if (!subSnap.empty) {
          // サブコレクションの最初のメッセージ
          const first = subSnap.docs[0];
          const subData = first.data();
          message = subData.text || null;
          const convertedSubTimestamp = parseTimestamp(subData.timestamp);
          message_timestamp = convertedSubTimestamp ? convertedSubTimestamp : null;
          message_user_id = subData.userId || null;
        }

        // doc.data().timestamp もあるが こちらはnotice全体のtimestamp？
        // createTables.js の "date" は text, "message" は text, "message_timestamp" は TIMESTAMP
        const convertedTimestamp = parseTimestamp(data.timestamp);

        const { error } = await supabase
          .from('notices')
          .upsert({
            id: doc.id,
            date: doc.id, // 例: "2025-02-05"
            message,
            message_timestamp,
            message_user_id,
            // message 以外の情報があれば補完
            // message テーブルを別途作る or JSONBフィールドにまとめるなどが望ましいかもしれません
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('Error upserting notices:', doc.id, error);
        } else {
          console.log('Upserted notices:', doc.id);
        }
      }
    }

    // -------------------------
    // counters コレクション -> counters テーブル
    // -------------------------
    {
      const snapshot = await db.collection('counters').get();
      console.log(`Found ${snapshot.size} counters in Firestore`);
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Firestoreでは doc.id = 'member_number' など
        // supabaseの counters テーブルには "id", "latest_number", "updated_at" カラム
        // updatedAt というフィールドが存在する場合 -> parseTimestamp() などで変換
        const convertedTimestamp = parseTimestamp(data.updatedAt);

        const { error } = await supabase
          .from('counters')
          .upsert({
            id: doc.id,
            latest_number: data.latest_number,
            updated_at: convertedTimestamp ? convertedTimestamp : null,
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('Error upserting counters:', doc.id, error);
        } else {
          console.log('Upserted counters:', doc.id);
        }
      }
    }

    // -------------------------
    // foreigner コレクション -> foreigner テーブル
    // -------------------------
    {
      const snapshot = await db.collection('foreigner').get();
      console.log(`Found ${snapshot.size} foreigner docs in Firestore`);
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // createTables.js では foreigner テーブルは
        //   id TEXT PRIMARY KEY
        //   timestamp TIMESTAMP WITH TIME ZONE
        // となっている。
        // Firestore側で doc.id が "2022-06-14 15:45:47.271" のような場合があるかもしれないので
        // それを文字列のまま使うのか、変換するのか検討必要
        // 例としてdoc.idを idにし、data.timestampを parseTimestamp
        const convertedTimestamp = parseTimestamp(data.timestamp);

        const { error } = await supabase
          .from('foreigner')
          .upsert({
            id: doc.id,
            timestamp: convertedTimestamp ? convertedTimestamp : null,
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('Error upserting foreigner:', doc.id, error);
        } else {
          console.log('Upserted foreigner:', doc.id);
        }
      }
    }

    console.log('Data migration completed successfully!');
  } catch (error) {
    console.error('Error migrating data:', error);
  }
}

migrateData();