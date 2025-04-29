
document.getElementById ("url").addEventListener('paste', function(event) {
  const pastedText = event.clipboardData.getData('text');
  console.log('Pasted text:', pastedText);
  chrome.runtime.sendMessage({ action: 'entered_url', param: pastedText });
  window.setTimeout ( () => {window.close();}, 1000);
});
