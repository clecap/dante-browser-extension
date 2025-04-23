let listing = document.getElementById ("listing");  // the element which shall display the listing


// #region HANDLERS FOR ANSWERS
// NOTE: having full functions instead of array functions allows us to obtain function names on debug  


// function which handles the answer from the service worker to a listCount request
// response.answer is a version map
function handleAnswerCount (response) {
  console.log ("handling list-count answer");
  let txt = "";
  if (!response || !response.answer) {return;}
  for ( const key in response.answer ) {
      let count = response.answer[key];
      let keyD = key.slice(0, -1); // for display: remove the last character, which is a !
      txt += `<tr><td class='fileName' title='${keyD}'>${keyD}</td><td title="Number of versions stored on server">${count}</td>
        <td><button data-src="${keyD}" data-action="down" title="Download bookmark file from server and add to locals">Down</button>
             <button data-src="${keyD}" data-action="up" title="Upload current bookmarks to server under this filename. No overwrite but versioning.">Up</button>
             <button data-src="${keyD}" data-action="del" title="Delete this bookmark file on server.">Del</button>
             <button  data-src="${keyD}" data-action="gc" title="Garbage collect: Delete all versions except last 10">GC</button>
        </td></tr>`;
  }
  listing.innerHTML = txt;
}

// #endregion




// TODO: need: click on the file link opens up ALL bookmarks in the file in tabs of a new window !




// maps the action verb names to the handler in case we eventually might have more than one kind of handler to service worker responses
const MAP_HANDLERS = {
  "listCount":  handleAnswerCount,
  "del":        handleAnswerCount,
  "new":        handleAnswerCount,
  "win":        handleAnswerCount,   "winC":       handleAnswerCount,  "all":       handleAnswerCount,  "allC":       handleAnswerCount,
  "up":         handleAnswerCount
};


// send a command to the serviceworker and handle the answer
// action is a command verb,  para is an optional parameter and place helps identify who initiated this round of the protocol
const sendCommandAndHandleAnswer = (action, para, place, query) => {
  let handleAnswer = MAP_HANDLERS[action] || ( function emptyHandler ()  {} ) ;     // map the handler or use empty handler; should be function to have name available for it
  console.log ("UI sends command with action=" +action+ " from place=" +place+ " para=" + para + " handler=" + handleAnswer.name + " query=",query);
  chrome.runtime.sendMessage ( {action, para, place, query}, response =>  { 
    console.log ("UI received response to action="+action+ " from place="+place + " with para=" + para + " handler=" + handleAnswer.name + " query=", query);
    console.log ("...response received is ", response);
    handleAnswer (response)} );
};

// detect UI command and send it to the service worker
document.body.addEventListener ("click", (e) => {    // console.log ("UI was clicked on target: ", e.target);
  if ( !e.target.dataset ) {console.warn ("no dataset found on target - should not happen"); return;}
  if ( !e.target.dataset.action ) { console.info ("no action attribute found in UI element, probably irrelevant click "); return;}
  let action = e.target.dataset.action;
  let src;

  // obtain parameters
  if ( ["new","win", "winC", "all", "allC"].includes (action) )        { src = document.getElementById("newFilename").value; src=src.trim()+"!"; /* console.log ("UI: action new found with filename=", src); */ }  // New action gets parameter from input field
  else if (action == "list" || action == "listCount")  { src = null; }            // list and listcount action need no parameter
  else                        { src = e.target.dataset.src + "!"; }                     // otherwise it is encoded into the html elements data-src and might be undefined


  // obtain query parameter
  let query;
  if      (action == "win" || action == "winC" )  { query = {currentWindow: true}; }
  else if (action == "all" || action == "allC" )  { query = {};                    }
  else                                            { query = null;                  }

  // sanitize parameters
  if (src !== null && src !== undefined) {  // only in these cases we must sanitize input
    const regex = /[A-Za-z0-9_\/]+/;
    if (regex.test (src)) {console.log("UI: regex test ok on " + src);} else {alert ("Name must be non-empty and may only contain A-Z a-z 0-9 _ \\ ."); return;}
  }

  sendCommandAndHandleAnswer (action, src, 1, query);
});


// every entered character generates an input event - we filter out what we do not want
document.getElementById("newFilename").addEventListener("input", function (e) { console.log ("input"); this.value = this.value.replace(/[^A-Za-z0-9_\/]/g, ""); });


// send a list command to the backend for the initial listing

//setTimeout ( () => 
sendCommandAndHandleAnswer ("listCount", null, 4, handleAnswerCount)
//, 1000);


