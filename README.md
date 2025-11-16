# Mochitecture

**言語設計 × UI × Web。**  
抽象の言語化からミニマルなUI設計、静的Web実装までを「最小で最速」に届ける個人スタジオのミニサイトです。

- 4ページ構成（`/`, `/archive`, `/about`, `/contact`）
- 共通ヘッダー / フッターを `partials/` で共通化
- `assets/base.css` によるシンプルなデザイン基盤
- 各種 UI デモ（`/demos`）
- コーディング規約をまとめた **Web Coding Design Pattern** ページ（`/web-coding-design-pattern.html`）

---

## Structure

```txt
.
├─ assets/
│  ├─ base.css          # サイト全体のスタイル基盤
│  └─ include.js        # partials 読み込み & nav.active 付与 & 年号注入
├─ demos/
│  ├─ calender/
│  │  ├─ index.html     # Schedule - Week View デモ
│  │  ├─ styles.css
│  │  └─ app.js
│  └─ energy-map/
│     ├─ index.html     # Energy Map デモ
│     ├─ energy-map.css
│     ├─ energy-map.js
│     └─ JP-EnergyAreas.svg
├─ partials/
│  ├─ header.html       # サイト共通ヘッダー
│  └─ footer.html       # サイト共通フッター
├─ about.html
├─ archive.html
├─ contact.html
├─ index.html
└─ web-coding-design-pattern.html  # Coding Design Pattern ドキュメント
