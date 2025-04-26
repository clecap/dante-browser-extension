


document.addEventListener('paste', async (event) => {
  const items = event.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image')) {
      const file = item.getAsFile();
      // Send the file to the background script for upload
      chrome.runtime.sendMessage({ action: 'uploadImage', file: file });
    }
  }
});



chrome.runtime.onMessage.addListener( (message, sender, sendResponse) => {
  console.log ("content script received", message);
  if (message.action === 'get_tab_size') {
    console.log ("window size is", window.innerWidth, window.innerHeight);
    sendResponse ( {width: window.innerWidth, height: window.innerHeight } );
  }
});


console.log('✅ Content script injected and running.');