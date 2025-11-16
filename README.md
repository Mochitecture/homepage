# Mochitecture

**言語設計 × UI × Web。**  
抽象の言語化からミニマルな UI 設計、静的 Web 実装までを  
「**最小で最速**」に届ける個人スタジオのミニサイトです。

Mochitecture は、  
**“文章 → UI → Web” をひとつの線でつなぐ最小単位** をテーマに、  
小さく作り、すぐ出し、読み返せる構造で運用しています。

---

## Features

- **4 ページ構成**
  - `/`（Top）
  - `/archive`
  - `/about`
  - `/contact`

- **共通レイアウト**
  - `partials/header.html`
  - `partials/footer.html`
  - `assets/include.js` による自動読み込み + nav.active + 年号注入

- **シンプルなデザイン基盤**
  - `assets/base.css`（Tokens / Layout / Components / Pages）

- **UI デモ（/demos）**
  - `calender`（週ビュー UI）
  - `energy-map`（電力エリア可視化 UI）

- **Web Coding Design Pattern**
  - `/web-coding-design-pattern.html`
  - Mochitecture 全体の HTML/CSS/JS/Folder/Naming の指針を体系化した基準書

- **Archive カード自動生成（準備中）**
  - JSON（`archive-data.js`）を編集するだけで Archive に反映される軽量運用

---

## Project Structure

```txt
.
├─ assets/
│  ├─ base.css                  # サイト全体のスタイル基盤
│  ├─ include.js                # partials 読み込み / nav.active / 年号設定
│  ├─ archive-data.js           # Archive のカード定義（準備中）
│  └─ archive.js                # Archive 自動生成（準備中）
│
├─ demos/
│  ├─ calender/
│  │  ├─ index.html             # Schedule - Week View UI のデモ
│  │  ├─ styles.css
│  │  └─ app.js
│  └─ energy-map/
│     ├─ index.html             # Energy Map デモ
│     ├─ energy-map.css
│     ├─ energy-map.js
│     └─ JP-EnergyAreas.svg
│
├─ partials/
│  ├─ header.html               # 共通ヘッダー
│  └─ footer.html               # 共通フッター
│
├─ index.html                   # Top
├─ archive.html                 # Archive（自動生成コンテナ化予定）
├─ about.html                   # About
├─ contact.html                 # Contact
└─ web-coding-design-pattern.html
                                # Coding Design Pattern ドキュメント
