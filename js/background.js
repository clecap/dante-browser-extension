// This is the main background worker script


const EXTENSIONID="cnkdelgmbnkedmcohgnnhnebfendmkgb";  // the extension ID derived from the key in the manifest (the key is a correctly formed private key, needed for chrome to accept this and keept extensionid constant)

import {setStatus} from "/js/status.js"


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





chrome.runtime.onInstalled.addListener(() => {  // This will run once when the extension is installed.
  console.log('Extension installed!');
  chrome.tabs.create({ url: chrome.runtime.getURL('html/welcome.html') });
  setStatus();
});





// trigger checking log in status
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.cookie.domain === DOMAIN && changeInfo.cookie.name === "wikidb_session") {
    // Detect when the session cookie changes (login/logout)
    if (changeInfo.removed) {
      console.log("User might have logged out"); setStatus()
    } else {
      console.log("User might have logged in");  setStatus();
    }
  }
});


// TODO: must be read again after a change in storage !!
let WIKI, DOMAIN;

async function init () {
  let response = await chrome.storage.local.get ( [ "WIKI", "DOMAIN" ] );
  WIKI = response.WIKI;
  DOMAIN = response.DOMAIN;
}


//
chrome.webNavigation.onCompleted.addListener ( async (details) => {
    let response = await chrome.storage.local.get ( [ "WIKI", "DOMAIN" ] );
    DOMAIN = response.DOMAIN;
    if ( details.url.includes (WIKI) ) {
      console.log("Request sent to DanteWiki:", details);
      setStatus();
    } 
  }, 
  { url: [ { hostEquals: DOMAIN, queryContains: "title=Special:UserLogin" } ] }
);



setStatus();  // set status