// This is the main background worker script


const EXTENSIONID="cnkdelgmbnkedmcohgnnhnebfendmkgb";  // the extension ID derived from the key in the manifest (the key is a correctly formed private key, needed for chrome to accept this and keept extensionid constant)

import {setStatus}      from "/js/status.js"
import {extractDomain}  from "/js/mediawiki.js"
import {removeQuery}    from "/js/mediawiki.js"
import {uploadFile}     from "/js/mediawiki.js"


/** THIS is the main listener where the service worker offers to react on messages */
chrome.runtime.onMessage.addListener ( (message, sender, sendResponse) => {
  console.log ("backend received message", message, sender);

  switch (message.action) {
    case 'capture_tab':
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

    case "popup_run": console.log ("backend received: popup_run");
      setStatus ();
      break;

    case "entered_url":  console.log ("entered_url: background received info from options page");
      let WIKI=message.param.trim();
      let DOMAIN=extractDomain (WIKI);
      chrome.storage.local.set ( { WIKI, DOMAIN}, () => {console.log('Value stored!');});
      break;


    case "upload_file":  console.log ("background was asked to upload file, message was: ", message);
      let uint8 = new Uint8Array (message.buffer);
      const blob = new Blob([uint8], { type: message.mimeType });
      const identification = message.identification;   // for proper UI feedback and reidentification of call and response
      (async () => { // start async activity
        let res = await uploadFile (  blob,  message.fileName, message.mimeType ); 
        res.identification = identification;   // patch in the identification into the response again
        console.log ("did upload, result:", res);

// need to do an async reporting to user !!!

/*
  if (res.exception) {}
  if (res.error) {}
  if ...

*/

  sendResponse ( {response: "upload_completed", details: res} );


      })();  // END ASYNC
      console.log ("upload was initiated");
      return true;  // we will send an asynchronous response

      break;

// this is handled as response object
/*
    case "got_clipboard_info":  console.log ("got_clipboard_info: background received clipboard info");
      buildPasteContextMenu (action.param);
*/
  }
} );




chrome.runtime.onInstalled.addListener(() => {  // This will run once when the extension is installed.
  console.log('Extension installed!');
  chrome.tabs.create({ url: chrome.runtime.getURL('html/welcome.html') });
  init();
  setStatus();
});



// given out ckipboard information object, build a context menu
// issue is: serviceworker cannot access the clipboard 
// cli is an array of an array of types
async function buildPasteContextMenu (cli) {
  const VERBOSE = false;
  if (VERBOSE) {console.group ("buildPasteContextMenu " + cli);}
  chrome.contextMenus.create ( {id: "dante-parent", title: "DanteWiki", contexts: ["editable"] } );  // build the parent for all context menu elements
  cli.forEach ( (item, idx) => {               // iterate clipboard items, in most cases only one
    item.forEach ( (type) => {
       if (VERBOSE) console.log ("building context menu for type ", type);
       chrome.contextMenus.create ( {id: "dante-paste-as-"+type,   parentId: "dante-parent", title: "Paste as " + type, contexts: ["editable"] } );
    });
    } );
  if (VERBOSE) {console.log ("context menu has beeen built"); console.groupEnd();}
}



chrome.contextMenus.onClicked.addListener ( async (info, tab) => {
  // console.log ("context menu was clicked at ", info, tab);
  let result = await chrome.scripting.executeScript ( {target: { tabId: tab.id }, args: "TEXT", func: inject } );
  // TODO NOW ????
});





const askTabForClipboard = async (tab) => {
  console.log ("askTabForClipboard: background is asking for clipboard information");
  if (!tab) { console.log ("askTabForClipboard: no tab was specified, looking for active tab in current window");
    let tabs = await chrome.tabs.query ( {active: true, currentWindow: true} );
    if (tabs.length == 0) { console.warn ("askTabForClipboard: could not find any active tab in current window"); return;} 
    else                  {tab = tabs[0];}
  }

  // check if it is reasonable to expect clipboard access
  let url = (tab.url.length==0 ? tab.pendingUrl : tab.url);  // tab might not have committed yet and is still loading, eg welcome.html after extension install
  if (url.startsWith("chrome-extension://"))      {console.log("Tab found is a Chrome extension page - no clipboard access"); return;} 
  else if (url.startsWith("chrome://"))           {console.log("Tab found is a Chrome internal page - no clipboard access");  return;}
  else if (url.startsWith("chrome-untrusted://")) {console.log("Tab found is an untrusted Chrome page - no clipboard access"); return;} 
  else                                            {console.log("Tab found " + url + " contains a regular web page - we have clipboard access");}

  let promiseResponse = chrome.tabs.sendMessage ( tab.id, {action: 'get_clipboard_info'} );
  // console.log ("request was sent to active tab and response promise is ", promiseResponse);
  try {
    let response = await promiseResponse;
    console.log ("promised response has resolved to ", response, "building context menu for ", response.param);
    buildPasteContextMenu (response.param);
  } catch (x) { console.warn ("Unable to obtain response"); console.warn (x);}
}



// TODO: when a new tab is activated we probably do not have to change the clipboard stuff?????  - or maybe the clipboard has changed ?? check ???
// we might grab the clipboard activity somewhere in the content scripts and this might be better.... ?????
chrome.tabs.onActivated.addListener ( (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {console.log("New tab was activated:", tab); askTabForClipboard (tab); });
});



// after a change in window focus
chrome.windows.onFocusChanged.addListener( async (windowId) => {
  console.log ("A window focus change was detected");
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    console.log ("We left chrome and entered another application or another chrome profile, removing all our context menus");
    chrome.contextMenus.removeAll();
  } 
  else {
    const myWindow  = await chrome.windows.get(windowId, { populate: true });
    const activeTab = myWindow.tabs.find(t => t.active);
    if (activeTab) {console.log("A chrome window got focused, active tab is:", activeTab); askTabForClipboard (activeTab);  }
  }
});


// TODO: might be obsolete since we are not using wikidb_session cookie - check if the other handlers are sufficient....
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


const logOnOffListener = async (details) => { 
   console.log ("+++++ LOGONOFF LISTENER " + WIKI + " and " + DOMAIN);
   console.log ("DETAILS ", details);
  if ( details.url.includes (WIKI) ) {
    console.log("Request sent to DanteWiki:", details);
    setStatus();
  } 
};




const cookieListener = ( ci ) => {
  // console.log ("Cookie change ", ci);
  if (ci.cookie.domain !== DOMAIN)               {return;}     // ignore cookies which are not for this domain
  if ( !ci.cookie.name.endsWith ("UserName") )   {return;}     // ignore cookies which do not end on UserName
  if ( ci.removed === true )                     {return;}     // ignore removal of cookies
                                                               // logout does not remove cookies but login does and this ignoring prevents double handler invocation
  console.log ("----- Cookie change triggered a status check due to ", ci);
  setStatus();
};

const clickListener = (tab) => {
  console.log ("clicked on extension icon");
  setStatus ();
};


async function init () {
  let response = await chrome.storage.local.get ( [ "WIKI", "DOMAIN" ] );
  WIKI = response.WIKI;
  DOMAIN = response.DOMAIN;

  console.log ("Running initialization at " + WIKI + " and " + DOMAIN);

  // we want to catch a logon process. Since logon uses a form and a 302 redirect we need to do this watching cookies since interestingly enough it does not work with webNavigation
  chrome.cookies.onChanged.removeListener ( cookieListener );
  chrome.cookies.onChanged.addListener    ( cookieListener );

  chrome.webNavigation.onCompleted.removeListener ( logOnOffListener );   // remove old listener, if any, since the filters might have changed since last adding
  chrome.webNavigation.onCompleted.addListener ( logOnOffListener,
    { url: [ { hostEquals: DOMAIN, queryContains: "title=Special:UserLogout" } ] } );

  chrome.action.onClicked.removeListener (clickListener);
  chrome.action.onClicked.addListener    (clickListener);
}


init();
setStatus();  // set status