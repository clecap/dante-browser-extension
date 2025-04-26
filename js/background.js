// This is the main background worker script




const EXTENSIONID="cnkdelgmbnkedmcohgnnhnebfendmkgb";  // the extension ID derived from the key in the manifest (the key is a correctly formed private key, needed for chrome to accept this and keept extensionid constant)
const WIKI="https://localhost:4443/wiki-dir/";


async function fetchWithTimeout (url, options = {}, timeout = 5000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {...options, signal: controller.signal })
    if (!response.ok) { throw new Error('Network response was not ok'); }
    return await response.json()
  } catch (error) {
    if (error.name === 'AbortError') {console.error('Fetch timed out');} else {console.error('Fetch failed:', error);}
    throw error; 
  } finally { clearTimeout(id); }
}


async function getUploadToken() {
  const response = await fetch('https://your-mediawiki-site/api.php?action=query&meta=tokens&type=upload&format=json');
  const data = await response.json();
  return data.query.tokens.upload;
}

async function uploadImage(file) {
  const token = await getUploadToken();

  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('filename', file.name);
  formData.append('file', file);
  formData.append('token', token);
  formData.append('format', 'json');

  const response = await fetch('https://your-mediawiki-site/api.php', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.error) {
    console.error('Upload failed:', data.error);
  } else {
    console.log('Upload successful:', data);
  }
}





chrome.runtime.onMessage.addListener ( (message, sender, sendResponse) => {
  console.log ("backend received message", message, sender);

  if (message.action === 'capture_tab') {

    (async () => {
      console.log ("capturing visible tab");
      let dataUrl = await chrome.tabs.captureVisibleTab (null, { format: 'png' } );
      console.log ("got dataURL", dataUrl);
      console.log ("querying for active tab");
      let tabs    = await chrome.tabs.query ( { active: true, currentWindow: true } );   // get active tab
      const tab = tabs[0];
      console.log ("got tab", tab);
      console.log ("sending get_tab_size");
      let response = await chrome.tabs.sendMessage ( tab.id, { action: 'get_tab_size' } ); // ask tab content script for tab size
      console.log ("received answer for get_tab_size request");
      let width= 800; let height = 600;   // default
      if (chrome.runtime.lastError) { console.error("Could not get tab size", chrome.runtime.lastError.message); }
      else { console.log("Active tab size:", response.width, response.height); width = response.width; height = response.height; }
      let win = await chrome.windows.create({ url: "html/cropper.html?img=" + encodeURIComponent(dataUrl), type: 'popup', width, height} );
      console.log ("the following window has been created", win);
    })();
    return true;

}

} );



chrome.storage.local.set ( { WIKI}, () => {console.log('Value stored!');});


chrome.runtime.onInstalled.addListener(() => {  // This will run once when the extension is installed.
  console.log('Extension installed!');
  chrome.tabs.create({ url: chrome.runtime.getURL('html/welcome.html') });
  checkLoggedOn();
});





// check if user is logged on to a specific dante wiki, and if yes, display status on the extension
async function checkLoggedOn () {
  console.log ("Will check logon status for " + WIKI);
  let URL = WIKI + "/api.php?action=query&meta=userinfo&format=json";

  try {
    let response = await fetchWithTimeout ( URL, { method: 'POST'} );
    console.log ("Got reply", response);
     // use a "POST", because we want the client to send an Origin header in the request
    // the origin header must be sent to allow the server proper handling of the CORS situation according to the Access-Control-Allow-Origin settings

    let data = await response.json();
    console.log ("checkLoggedOn data", data);
    const username = data?.query?.userinfo?.name;
    const anon = data?.query?.userinfo?.anon;
    if (anon === undefined)  {
      console.log("✅ Logged in as", username);
      chrome.action.setBadgeText({ text: '✅' });
      chrome.action.setTitle ( {title: "New Tooltip Text"} );
    //  chrome.action.setBadgeBackgroundColor({ color: '#90EE90' }); // Green
    } else {
      console.log("🔒  Not logged in");
      chrome.action.setBadgeText({ text: '🔒' });
      chrome.action.setBadgeBackgroundColor({ color: '#FFCCCC' }); // Red
    }
  }
  catch (x) {
    console.error ("Caught ", x);
    chrome.action.setBadgeText({ text: '❌' });
     chrome.action.setTitle ( {title: "New Tooltip Text"} );

  }


}


const DOMAIN = "localhost";

// trigger checking log in status
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain === DOMAIN && changeInfo.cookie.name === "wikidb_session") {
    // Detect when the session cookie changes (login/logout)
    if (changeInfo.removed) {
      console.log("User might have logged out"); checkLoggedOn();
    } else {
      console.log("User might have logged in");  checkLoggedOn();
    }
  }
});

checkLoggedOn();






