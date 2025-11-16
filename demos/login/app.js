/*
  File: /demos/login/app.js
  Role:
    - Login Demo のタブ切り替え
    - パスワードバリデーション（リアルタイム判定）
    - ✓（緑） / ✕（赤）表示の更新
    - パスワード一致（Confirm）判定
    - 「Sign up」ボタンの活性 / 非活性
*/

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initPasswordValidation();
});

/* ---------------------------------------------------------
   ① タブ切り替え
--------------------------------------------------------- */

function initTabs() {
  const tabs = document.querySelectorAll(".login-tab");
  const panels = document.querySelectorAll(".login-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.view;

      // active class の切り替え
      tabs.forEach((t) => t.classList.remove("is-active"));
      panels.forEach((p) => p.classList.remove("is-active"));

      tab.classList.add("is-active");
      document.querySelector(`.login-panel[data-view="${target}"]`).classList.add("is-active");
    });
  });
}

/* ---------------------------------------------------------
   ② パスワード バリデーション
   チェック内容：
      - 8文字以上
      - 大文字を含む
      - 小文字を含む
      - 数字を含む
      - 記号を含む
      - パスワードと確認が一致
--------------------------------------------------------- */

function initPasswordValidation() {
  const password = document.querySelector("input[name='password']");
  const confirm = document.querySelector("input[name='passwordConfirm']");
  const verifyButton = document.querySelector(".login-panel[data-view='signup'] .login-submit");

  if (!password || !confirm) return;

  const rules = {
    length: document.getElementById("pw-rule-length"),
    upper: document.getElementById("pw-rule-upper"),
    lower: document.getElementById("pw-rule-lower"),
    number: document.getElementById("pw-rule-number"),
    symbol: document.getElementById("pw-rule-symbol"),
    match: document.getElementById("pw-rule-match"),
  };

  function validate() {
    const pw = password.value;
    const cf = confirm.value;

    const checks = {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw),
      match: pw !== "" && pw === cf,
    };

    // UI 更新（✓ 緑 / ✕ 赤）
    Object.entries(checks).forEach(([key, pass]) => {
      rules[key].classList.toggle("is-ok", pass);
      rules[key].classList.toggle("is-ng", !pass);
    });

    // すべてOK → ボタン有効化
    const allGood = Object.values(checks).every((v) => v === true);
    verifyButton.disabled = !allGood;
  }

  password.addEventListener("input", validate);
  confirm.addEventListener("input", validate);

  // 初期状態
  validate();
}
