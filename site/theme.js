(() => {
  const allowed = new Set(['classic', 'classic-glass']);
  const apply = theme => {
    const selected = allowed.has(theme) ? theme : 'classic';
    document.documentElement.dataset.siteTheme = selected;
    window.dispatchEvent(new CustomEvent('family-theme-change', {detail:{theme:selected}}));
  };
  window.applyFamilyTheme = apply;
  apply('classic');
  fetch('/api/theme', {cache:'no-store', credentials:'same-origin'})
    .then(response => response.ok ? response.json() : null)
    .then(result => { if (result && result.theme) apply(result.theme); })
    .catch(() => {});
})();
