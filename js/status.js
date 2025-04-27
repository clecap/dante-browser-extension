let STATUS;
let USER;

import {getUser, WIKI} from "/js/mediawiki.js";



function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (char) => {
    const map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
    return map[char] || char;
  });
}




// display status in icon form
const displayStatus = () => {
  switch (STATUS) {  // global value from above
    case 'waiting':
      chrome.action.setBadgeText({ text: '⏳' });
      chrome.action.setTitle ( {title: "Waiting for reply from DanteWiki"} );
      break;
    case 'timeout':
      chrome.action.setBadgeText({ text: '🕒' });
      chrome.action.setTitle ( {title: "Timed out trying to reach DanteWiki"} );
      break;
    case 'error':
      chrome.action.setBadgeText({ text: '❌' });
      chrome.action.setTitle ( {title: "Cannot reach DanteWiki"} );
      break;
    case 'in':
      chrome.action.setBadgeText({ text: '✅' });
      chrome.action.setTitle ( {title: "Logged in into DanteWiki"} );
      break;
    case 'out':      
      chrome.action.setBadgeText({ text: '❌' });
      chrome.action.setTitle ( {title: "Not logged in into DanteWiki"} );
      break;
    default:
      chrome.action.setBadgeText({ text: '🔴' });
      chrome.action.setTitle ( {title: STATUS} );
  }
};

// must provide doc from the caller (popup)
export const displayUser = async ( doc ) => {
  const user = (await chrome.storage.local.get ( ['USER'] )).USER; // read from storae since we here might be in a different module instantiation (popup)
  console.log ("displaying user now in popup at document object ", doc);
  if (typeof doc === "undefined") { console.log ("returning, no document object ", doc); return;}   // when called from within a serviceworker context
  let loggedIn = doc.getElementById ("loggedIn");
  if (user !== null) {loggedIn.innerHTML = "Logged in as user: <b>" + escapeHTML (user) + "</b>"; doc.body.classList.add ("loggedIn"); doc.body.classList.remove ("loggedOut");}
  else               {loggedIn.innerHTML = "Please log in into DanteWiki! <a target='_blank' href='"+WIKI+"/index.php?title=Special:UserLogin&returnto=Main+Page'>log in</a>"; doc.body.classList.add ("loggedOut");doc.body.classList.remove("loggedIn");}
  // target=_blank" is a must due to cross site settings. If not set, the link is not navigated to.
  console.log ("displayed user in popup");
}


// if called from outside (ie without parameter) the status is obtained
// otherwise we also can call this with an explicit status setting
export const setStatus = async (val) => {
  if (val !== undefined && val !== null) { STATUS = val;} 
  else {
    try {
      USER = await getUser();
      if (USER === null)            { STATUS = "out";  } 
      else if (USER === undefined)  { STATUS = "error";} 
      else                          { STATUS = "in";   }
    } catch (error) { console.log (error);
      USER = undefined;
      STATUS = "Error: " + error;
    }
  }
  await chrome.storage.local.set( { STATUS, USER } );
  displayStatus();
  displayUser();

};

export default setStatus;


