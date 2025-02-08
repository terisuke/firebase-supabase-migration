# Firebase-Supabase Migration

このプロジェクトは、Firebase (Firestore) に保存されたデータを簡単に Supabase (PostgreSQL) に移行できるようにするためのサンプルです。
Firebase のテストデータを Supabase に移行する流れは、以下のようになります:

1. Firebase にテストデータをインポート
2. Supabase 上にテーブルを作成
3. Firebase (Firestore) から Supabase にデータ移行 (マイグレーション)

このリポジトリには、上記のステップを行うための Node.js スクリプトが含まれています。

## 目次

1. 環境要件 (Requirements)
2. 事前準備
    * 2.1 Firebase プロジェクトの準備
    * 2.2 Supabase プロジェクトの準備
3. プロジェクトのセットアップ
    * 3.1 リポジトリのクローンと依存関係のインストール
    * 3.2 .env ファイルの作成
    * 3.3 Firebase のサービスアカウントキー配置
4. 実行手順
    * 4.1 Firebase へテストデータをインポート
    * 4.2 Supabase にテーブルを作成
    * 4.3 データの移行 (Firebase → Supabase)
5. ディレクトリ構成
6. 主なファイル説明
7. ライセンス

## 環境要件

* Node.js (推奨: v16 以降)
* npm (または yarn)
* Firebase アカウント (Firestore)
* Supabase アカウント

## 事前準備

### Firebase プロジェクトの準備

1. [Firebase コンソール](https://console.firebase.google.com/) にアクセスし、新規または既存のプロジェクトを開きます。
2. Firestore を有効にします（「データベースを作成」を選択し、Firestore を使えるようにする）。
3. サービスアカウントキー (Firebase Admin SDK) を取得します。
    1. プロジェクトの設定 → 「サービスアカウント」
    2. 「新しい秘密鍵の生成」をクリックし、`serviceAccountKey.json` をダウンロードします。
    3. 後ほど、このファイルをプロジェクトのルートディレクトリに配置します（`firebase-supabase-migration/serviceAccountKey.json`）。

### Supabase プロジェクトの準備

1. [Supabase](https://supabase.com/) にアクセスし、アカウントを作成（またはログイン）します。
2. 新しいプロジェクトを作成します（無料プランの枠内で OK です）。
3. 「Project Settings」→「API」タブで、Project URL (SUPABASE_URL) と SERVICE_ROLE (SUPABASE_SERVICE_ROLE_KEY) をメモしておきます。
4. Database URL や ホスト (DB Host)、パスワード などの情報も確認できます（「Settings → Database」タブなど）。こちらも .env に書き込むために覚えておきます。

## プロジェクトのセットアップ

### リポジトリのクローンと依存関係のインストール

1. ターミナルまたはコマンドプロンプトで、このリポジトリをクローンします。

    ```bash
    git clone https://github.com/terisuke/firebase-supabase-migration.git
    cd firebase-supabase-migration
    ```

2. Node.js の依存関係をインストールします。

    ```bash
    npm install
    ```

    または

    ```bash
    yarn
    ```

### .env ファイルの作成

* プロジェクトルートに `.env.template` が用意されています。これを参考に `.env` という名前のファイルを作成し、以下の環境変数を設定します。

    ```bash
    cp .env.template .env
    ```

* `.env` の中身を編集します。

    ```
    SUPABASE_URL=your-project-url
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    # どちらも https://supabase.com/dashboard/project/{YourSupabaseProjectID}/settings/api から取得

    SUPABASE_HOST=your-database-host
    SUPABASE_USER=postgres
    SUPABASE_PASSWORD=your-database-password
    ```

* `SUPABASE_URL`:  Supabase プロジェクトの URL (例: `https://xxxxxxxxxx.supabase.co`)
* `SUPABASE_SERVICE_ROLE_KEY`:  「SERVICE_ROLE」キー (非常に機密性が高いので、絶対に公開しないでください)
* `SUPABASE_HOST`: Supabase のデータベースホスト (例: `db.xxxxx.supabase.co` など)
* `SUPABASE_USER`: デフォルトだと `postgres`
* `SUPABASE_PASSWORD`: Database password (プロジェクト作成時に表示されるか、「Settings → Database」タブで確認)

**注意:**
`.env` は `.gitignore` に含まれているため、GitHub 等にプッシュされることはありません。必ず機密情報が入った状態で公開しないように注意してください。

### Firebase のサービスアカウントキー配置

* 先ほどダウンロードした `serviceAccountKey.json` を、プロジェクトルートに配置します。
    ファイル名を**serviceAccountKey.json** に変更し、この場所に置いてください:

    ```
    firebase-supabase-migration/
      ├── createTables.js
      ├── importData.js
      ├── migrateData.js
      ├── serviceAccountKey.json     <-- ここ
      └── ...
    ```

## 実行手順

### 4.1 Firebase へテストデータをインポート

* `importData.js` を使って、`testData/` フォルダにある JSON データをテスト用の Firebase (Firestore) データベースへ一括インポートします。

    ```bash
    node importData.js
    ```

* 成功すると、コンソールに

    ```
    users imported
    logs imported
    nfc imported
    notice imported
    counters imported
    foreigner imported
    ```

    のような出力が出て、Firestore にデータが作成されます。

### 4.2 Supabase にテーブルを作成

* `createTables.js` を使って、Supabase (PostgreSQL) に必要なテーブルを作成します。
* 事前に `.env` ファイルで正しい接続情報 (SUPABASE_HOST, SUPABASE_USER, SUPABASE_PASSWORD など) が設定されているか再度確認してください。

    ```bash
    node createTables.js
    ```

* 成功すると

    ```
    exec function created
    users table created
    logs table created
    ...
    foreigner table created
    ```

    のようなログが表示されます。

### 4.3 データの移行 (Firebase → Supabase)

* 最後に `migrateData.js` を実行します。
* すると、Firestore にあるデータを読み取り、Supabase の各テーブルへアップサート(INSERT または UPDATE) します。

    ```bash
    node migrateData.js
    ```

* 成功例のコンソール出力(一部):

    ```
    Found 1 users in Firestore
    Upserted user: 000000
    Found 1 logs in Firestore
    Upserted log: zUscVSg4AjcbyJVMdC
    Found 1 nfc items in Firestore
    Upserted nfc: 010102121D1E2C05
    ...
    Data migration completed successfully!
    ```

* もしエラーが出た場合は、`.env` の設定ミスやネットワーク接続の問題、あるいは Firestore 側のデータ構造が想定と異なる可能性があります。エラーログを参考に修正を行ってください。

## ディレクトリ構成

```
firebase-supabase-migration/
├── .env.template           # Supabase 接続情報のテンプレート
├── .gitignore
├── createTables.js         # Supabase用のテーブルを作成するスクリプト
├── importData.js           # testData/ -> Firebase (Firestore) へデータをインポート
├── migrateData.js          # Firebase -> Supabase へのデータ移行スクリプト
├── package.json
├── package-lock.json
├── serviceAccountKey.json  # Firebase Admin SDK用の秘密鍵 (手動で配置)
└── testData
    ├── counters.json
    ├── foreigner.json
    ├── logs.json
    ├── nfc.json
    ├── notice.json
    └── users.json
```

## 主なファイル説明

1. `.env.template`
    * Supabase 接続情報のひな形です。このファイルをもとに `.env` を作成し、必要な値を記入します。
2. `serviceAccountKey.json`
    * Firebase Admin SDK 用の秘密鍵ファイルです。このファイルを自分で取得し、ルートディレクトリに置いてください。
3. `createTables.js`
    * Supabase (PostgreSQL) 上に必要なテーブルを作成します。
    * テーブル定義はスクリプト内に記述されており、`node createTables.js` で実行します。
4. `importData.js`
    * `testData/` フォルダのサンプルデータを Firebase (Firestore) にアップロードするスクリプトです。
    * テスト用として、先に Firebase にデータを入れておきたい場合に使用します。
5. `migrateData.js`
    * Firebase (Firestore) のデータを Supabase に移行するスクリプトです。
    * `node migrateData.js` を実行すると、Firestore の各コレクションからデータを読み出し、Supabase 上の対応するテーブルに Upsert します。
    * タイムスタンプのパースやサブコレクション (notice/message) の扱いなどをカスタマイズできます。
6. `testData/*.json`
    * Firebase に投入するサンプルデータです。
    * `importData.js` で読み込み、Firestore コレクションへ追加するようになっています。
