/*
  File: /demos/login/app.js
  Version: v1.0 unified validation
  Role:
    - タブ切替（Sign in / Sign up / Forgot / Account / Devices）
    - Password バリデート（Sign up / Reset の両方）
    - パスワード一致チェック
    - ボタン有効化制御
*/

/* ------------------------------------------------------
   1. タブ切替
------------------------------------------------------ */

const tabs = document.querySelectorAll(".login-tab");
const panels = document.querySelectorAll(".login-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const view = tab.dataset.view;

    tabs.forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");

    panels.forEach(panel => {
      panel.classList.toggle("is-active", panel.dataset.view === view);
    });
  });
});

// Forgot → Reset などのボタン切り替え
document.querySelectorAll("[data-switch]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.switch;

    tabs.forEach(t => {
      t.classList.toggle("is-active", t.dataset.view === target);
    });

    panels.forEach(p => {
      p.classList.toggle("is-active", p.dataset.view === target);
    });
  });
});


/* ------------------------------------------------------
   2. Password Validation (共通ロジック)
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


/* ------------------------------------------------------
   3. Confirm Password 一致チェック
------------------------------------------------------ */

function updateMatch(checkEl, pw, confirmPw) {
  if (!checkEl) return;

  const item = checkEl.querySelector("[data-check='match']");
  if (!item) return;

  const match = pw.length > 0 && pw === confirmPw;
  if (match) {
    item.classList.add("valid");
  } else {
    item.classList.remove("valid");
  }
  return match;
}


/* ------------------------------------------------------
   4. Sign up のバリデーション
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

  const allValid = Object.values(result).every(v => v) && isMatch;
  signupButton.disabled = !allValid;
}

if (signupPw) {
  signupPw.addEventListener("input", validateSignup);
}
if (signupConfirm) {
  signupConfirm.addEventListener("input", validateSignup);
}


/* ------------------------------------------------------
   5. Reset Password のバリデーション
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

  const allValid = Object.values(result).every(v => v) && isMatch;
  resetButton.disabled = !allValid;
}

if (resetPw) {
  resetPw.addEventListener("input", validateReset);
}
if (resetConfirm) {
  resetConfirm.addEventListener("input", validateReset);
}
