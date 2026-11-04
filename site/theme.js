(() => {
  const allowed = new Set(['classic', 'light-glass', 'dark-glass']);
  const apply = theme => {
    const chosen = allowed.has(theme) ? theme : 'classic';
    document.documentElement.dataset.familyTheme = chosen;
    window.dispatchEvent(new CustomEvent('familythemechange', {detail:{theme:chosen}}));
    return chosen;
  };
  window.applyFamilyTheme = apply;
  apply('classic');
  fetch('/api/theme', {cache:'no-store', credentials:'same-origin'})
    .then(response => response.ok ? response.json() : null)
    .then(result => { if (result && result.theme) apply(result.theme); })
    .catch(() => {});
})();
