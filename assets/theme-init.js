/* Runs before paint to apply the saved theme/language and avoid a flash.
   Kept external so the page can use a strict script-src 'self' CSP. */
(function () {
  try {
    var t = localStorage.getItem("sop-theme");
    if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    var l = localStorage.getItem("sop-lang");
    if (l) document.documentElement.setAttribute("lang", l);
  } catch (e) {}
})();
