// Access code screen, shown before anything else when js/access.js lists
// codes. A correct code is remembered in this browser (localStorage
// "sp-access"); if that code is later removed from the list, the screen
// shows again. Only stops casual visitors: the app's code is public.
const ACCESS_KEY = "sp-access";
let accessHash = null; // used when this browser cannot remember anything
const savedAccess = () => {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch (e) {
    return accessHash;
  }
};
const validCode = (h) => ACCESS_CODES.some((c) => c[1] === h);
const hasAccess = () => !ACCESS_CODES.length || validCode(savedAccess());
// Reference of the access code used in this browser, for the PDF footer
// ("" when no code is needed).
// Name of the access code used in this browser ("" when none).
const accessName = () => {
  const c = ACCESS_CODES.find((x) => x[1] === savedAccess());
  return c ? c[0] : "";
};
const accessRef = () => {
  const h = savedAccess();
  return ACCESS_CODES.length && validCode(h) ? codeRef(h) : "";
};

// Show the code screen; calls open() once a valid code is entered.
function showLock(open) {
  const old = savedAccess();
  $("#app").innerHTML =
    `<form id="lock" class="lock" autocomplete="off"><h1>Setup Procedures</h1>` +
    `<p class="m">Enter your access code to open the app.</p>` +
    (old
      ? `<p class="err">Your access code no longer works. Ask for a new one.</p>`
      : "") +
    `<label class="f">Access code<input id="lockCode" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label>` +
    `<p class="err" id="lockErr" role="alert"></p>` +
    `<button class="b" type="submit">Open</button></form>`;
  const form = $("#lock"),
    input = $("#lockCode");
  input.focus();
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const h = codeHash(input.value),
      btn = form.querySelector("button");
    btn.disabled = true;
    // A short wait makes guessing slow.
    setTimeout(() => {
      btn.disabled = false;
      if (!validCode(h)) {
        $("#lockErr").textContent =
          "That code is not right. Check it and try again.";
        input.select();
        return;
      }
      accessHash = h;
      try {
        localStorage.setItem(ACCESS_KEY, h);
      } catch (x) {}
      open();
    }, 600);
  });
}
