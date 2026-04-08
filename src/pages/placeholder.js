// Generic placeholder page for routes not yet implemented.
export function makePlaceholder(title, phase) {
  return async function render() {
    return `
      <div class="page-header">
        <div>
          <div class="crumbs">${phase}</div>
          <h1>${title}</h1>
        </div>
      </div>
      <div class="card">
        <p class="muted">Not built yet. Coming in ${phase}.</p>
      </div>
    `;
  };
}
