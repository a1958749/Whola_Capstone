// options.js
document.addEventListener('DOMContentLoaded', () => {
  const urlEl = document.getElementById('middlewareUrl');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load saved values
  chrome.storage.sync.get(['middlewareUrl'], (items) => {
    urlEl.value = items.middlewareUrl || '';
  });

  saveBtn.addEventListener('click', () => {
    const middlewareUrl = urlEl.value.trim();

    if (!middlewareUrl) {
      status.textContent = 'Middleware URL is required.';
      return;
    }
    // Save to chrome.storage.sync
    chrome.storage.sync.set({ middlewareUrl }, () => {
      status.textContent = 'Saved.';
      setTimeout(() => status.textContent = '', 2000);
    });
  });
});
