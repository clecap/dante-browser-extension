document.getElementById('capture-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'capture_tab' });
});