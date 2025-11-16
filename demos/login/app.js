/*
  File: /demos/login/app.js
  Version: v1.0 unified validation
  Role:
    - タブ切替（Sign in / Sign up / Forgot / Account / Devices）
    - Password バリデート（Sign up / Reset の両方）
    - パスワード一致チェック
    - ボタン有効化制御
*/

document.addEventListener("DOMContentLoaded", () => {
  /* ------------------------------------------------------
     1. タブ切替
  ------------------------------------------------------ */
  const tabs = document.querySelectorAll(".login-tab");
  const panels = document.querySelectorAll(".login-panel");

  function activateView(view) {
    tabs.forEach(t => {
      t.classList.toggle("is-active", t.dataset.view === view);
    });
    panels.forEach(p => {
      p.classList.toggle("is-active", p.dataset.view === view);
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      activateView(view);
    });
  });

  // 「再設定へ」などのショートカット
  document.querySelectorAll("[data-switch]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.switch;
      activateView(target);
    });
  });

  /* ------------------------------------------------------
     2. Password Validation 共通ロジック
  ------------------------------------------------------ */
  function validatePassword(pw) {
    return {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      symbol: /[^A-Za-z0-9]/.test(pw)
    };
  }

  function updateChecklist(checklistEl, result) {
    if (!checklistEl) return;
    checklistEl.querySelectorAll("[data-check]").forEach(item => {
      const key = item.dataset.check;
      if (result[key]) {
        item.classList.add("valid");
      } else {
        item.classList.remove("valid");
      }
    });
  }

  function updateMatch(checkEl, pw, confirmPw) {
    if (!checkEl) return false;
    const item = checkEl.querySelector("[data-check='match']");
    if (!item) return false;

    const match = pw.length > 0 && pw === confirmPw;
    if (match) {
      item.classList.add("valid");
    } else {
      item.classList.remove("valid");
    }
    return match;
  }

  /* ------------------------------------------------------
     3. Sign up のバリデーション
  ------------------------------------------------------ */
  const signupPw = document.getElementById("signup-password");
  const signupConfirm = document.getElementById("signup-confirm");
  const signupChecklist = document.getElementById("signup-checklist");
  const confirmCheck = document.getElementById("confirm-check");
  const signupButton = document.getElementById("signup-button");

  function validateSignup() {
    const pw = signupPw.value;
    const confirm = signupConfirm.value;

    const result = validatePassword(pw);
    updateChecklist(signupChecklist, result);

    const isMatch = updateMatch(confirmCheck, pw, confirm);
    const allValid = Object.values(result).every(Boolean) && isMatch;
    if (signupButton) signupButton.disabled = !allValid;
  }

  if (signupPw) signupPw.addEventListener("input", validateSignup);
  if (signupConfirm) signupConfirm.addEventListener("input", validateSignup);

  /* ------------------------------------------------------
     4. Reset Password のバリデーション
  ------------------------------------------------------ */
  const resetPw = document.getElementById("reset-password");
  const resetConfirm = document.getElementById("reset-confirm");
  const resetChecklist = document.getElementById("reset-checklist");
  const resetConfirmCheck = document.getElementById("reset-confirm-check");
  const resetButton = document.getElementById("reset-button");

  function validateReset() {
    const pw = resetPw.value;
    const confirm = resetConfirm.value;

    const result = validatePassword(pw);
    updateChecklist(resetChecklist, result);

    const isMatch = updateMatch(resetConfirmCheck, pw, confirm);
    const allValid = Object.values(result).every(Boolean) && isMatch;
    if (resetButton) resetButton.disabled = !allValid;
  }

  if (resetPw) resetPw.addEventListener("input", validateReset);
  if (resetConfirm) resetConfirm.addEventListener("input", validateReset);
});
