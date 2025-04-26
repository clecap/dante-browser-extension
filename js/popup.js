
let WIKI;

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char] || char;
  });
}






document.getElementById('capture-btn').addEventListener('click', async () => {
  console.log ("Sending message to backend for capturing...");
  chrome.runtime.sendMessage({ action: 'capture_tab' });

});



async function checkLogin () {
  let storageResult = await chrome.storage.local.get (['WIKI']);
  console.log('Value obtained from storage for WIKI: ', storageResult.WIKI);
  WIKI=storageResult.WIKI;
  const URL = WIKI + '/api.php?action=query&meta=userinfo&format=json';
  console.log ("Checking if I am still logged in, using this URL: " + URL);
  const whoAmIRes = await fetch (URL, { credentials: 'include',  method: 'POST' } );  // needs POST to have browser send Origin header
  const whoAmI    = await whoAmIRes.json();
  console.log('User info:', whoAmI.query.userinfo);
  let loggedIn = document.getElementById ("loggedIn");
  if (whoAmI.query.userinfo.id !== 0) {loggedIn.innerHTML = "Logged in as user: <b>" + escapeHTML (whoAmI.query.userinfo.name) + "</b>";}
  else {loggedIn.innerHTML = "Please log in into DanteWiki!";}
  



  return Promise.resolve (whoAmI.query.userinfo);
}

checkLogin();

// document.getElementById ("go").addEventListener ('click', checkLogin);

