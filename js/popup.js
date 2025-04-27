import {displayUser} from "/js/status.js";

document.getElementById('capture-btn').addEventListener('click', async () => {
  console.log ("Sending message to backend for capturing...");
  chrome.runtime.sendMessage({ action: 'capture_tab' });
});

document.addEventListener('DOMContentLoaded', () => {
  console.log ("DOMContent loaded in document ", document);
  displayUser (document);
});
