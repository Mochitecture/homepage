/* 
  File: assets/archive-data.js
  Role: Archiveページに表示するカードのデータ定義
  Notes:
    - ARCHIVE_ITEMS に新しいオブジェクトを追加するだけでカードが増える
    - 表示順は配列の順番（必要なら後でソートも可能）
*/

const ARCHIVE_ITEMS = [
  {
    id: 'arch-20251109-mini-landing',
    category: 'Case Study',
    title: 'Homepage',
    date: '2025-11-09',
    duration: '3h',
    status: '完了',
    lead: '“ゼロから3時間”で、Top〜Archiveまでの最小4ページ構成と自動デプロイ基盤を構築。',
    points: {
      before: '公開までの初動が重く、手が止まりがちだった',
      how: '静的4ページ＋partials共通化＋Vercel自動デプロイを設計',
      after: '以後は「カードを足すだけ」で更新可能に。運用負担を極小化'
    },
    tags: ['#HTML/CSS', '#Vercel'],
    link: null // リンクなし
  },
  {
    id: 'arch-20251110-schedule-week-proto',
    category: 'UI Prototype',
    title: 'Calendar',
    date: '2025-11-10',
    duration: '2h',
    status: '試作 v0',
    lead: 'Outlook / iPhone風の週グリッド UI を最小構成で試作し、用途別の視認性を確認。',
    points: {
      before: '仕事／私用／制作の予定が分断され、俯瞰しにくかった',
      how: '週×時間のグリッド上に用途別ブロックを配置。localStorageで軽量保存',
      after: '一画面で全体像を把握可能に。次段はドラッグ編集／レイアウト改善'
    },
    tags: ['#UI', '#CSS', '#JavaScript'],
    link: {
      href: '/demos/calender/',
      label: 'Calendar を見る'
    }
  },
  {
    id: 'arch-20251116-energy-map-00',
    category: 'Data Prototype',
    title: 'Energy Map',
    date: '2025-11-16',
    duration: '6h',
    status: 'UIフレーム v0.1',
    lead: '日本の電力エリアを「市場 × 需給 × 天気」で俯瞰するための最小UIフレームを試作。',
    points: {
      before: 'JEPX/EPRX/OCCTO/気象庁などの電力系データが分散し整理しづらかった',
      how: '上段「現在」、下段「Area（地図）」＋「Market Panel」の3ブロック構成でUI設計',
      after: 'Data & License で利用条件を整理しつつ、指標を段階的に実データへ接続可能に'
    },
    tags: ['#OpenData', '#Energy', '#UI', '#Prototype'],
    link: {
      href: '/demos/energy-map/',
      label: 'Energy Map を開く'
    }
  },
  {
    id: 'arch-20251116-web-coding-pattern',
    category: 'Design Doc',
    title: 'Web Coding Design Pattern',
    date: '2025-11-16',
    duration: '2h',
    status: 'v0.1',
    lead: 'Mochitecture を長期的に拡張・保守するためのコーディング規約を1ページに整理。',
    points: {
      before: '書き方が実装ごとに異なり、暗黙ルールが個人の頭の中にしかなかった',
      how: 'patterns.html に HTML/CSS/JS/フォルダ構成/コメント規約を体系化して集約',
      after: '新ページやデモの追加時、patterns を見るだけで即スタート可能に'
    },
    tags: ['#DesignDoc', '#HTML/CSS', '#JavaScript'],
    link: {
      href: '/web-coding-design-pattern.html',
      label: 'Web Coding Design Pattern を見る'
    }
  },
  // ここから Login のスナップショット
  {
    id: 'arch-20251116-login-structure',
    category: 'Auth Design',
    title: 'Login',
    date: '2025-11-16',
    duration: '3h',
    status: '構想 v1.0',
    lead: 'Sign in / Sign up / Forgot Password / Account Settings をひとまとめにし、認証コード・セッション・Remember me・デバイス管理までを設計した Login 構造。',
    points: {
      before: '認証やセッション、デバイス管理の要素が頭の中に散らばっており、実装時の全体像が掴みにくかった',
      how: '4画面＋Device Managementを基本ユニットにし、Email認証コード方式・30分セッション・Remember me・ログイン通知をセットで整理',
      after: '実装やレビュー時に「これを見れば全体が分かる」参照点となり、/demos/login デモとして可視化できる状態になった'
    },
    tags: ['#Login', '#Auth', '#Security', '#UIFlow'],
    link: {
      href: '/demos/login/',
      label: 'Login を開く'
    }
  },
  // ここから Local Sun Dome
  {
    id: 'arch-20251122-sun-dome',
    category: 'Visualization Demo',
    title: 'Local Sun Dome',
    date: '2025-11-22',
    duration: 'Plan',
    status: '構想 v0',
    lead: '現在地とローカル時刻から、太陽の高度・方位角と日の出／日の入りを算出し、半球ドームの中に「今の太陽位置」と一日の軌道を描く可視化デモ。',
    points: {
      before: '太陽高度や方位角の数値は扱えるものの、「今この場所で太陽がどこにあるのか」を空間的にイメージしにくかった。',
      how: 'ブラウザの Geolocation API で緯度・経度を取得し、バックエンドの SPA ベース API から太陽高度・方位角・日の出／日の入りを取得。SVG 上に半球ドーム（地平線・天頂・子午線）を描き、その内側に現在位置と太陽軌道をプロットする。',
      after: 'いまの空の状態を直観的に把握できるようになり、時刻と太陽の動きの関係が掴みやすくなった。将来的には PV の設置方位や影の動きのシミュレーションなど、エネルギー可視化への応用が見えてきた。'
    },
    tags: ['#SunPath', '#Geolocation', '#Visualization', '#Energy', '#JavaScript'],
    link: {
      href: '/demos/sun-dome/',
      label: 'Local Sun Dome を開く'
    }
  }
];
