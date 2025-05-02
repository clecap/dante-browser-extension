// this not available in here, use globalThis instead (according to LLM)

// content page sees a paste 
// paste may be the consequence of a mouse action or of a keyboard action

// CAVE: Data transfer items of an event stay valid only throughout the portion of an event handler
//       In a fresh execution context they are no longer there - so we must copy them before switching contexts!

// CAVE: The paste event has more data than the global clipboard. We see this in particular when copying from visual studio code and
//       pasting from that into a browser

document.addEventListener('paste', async (event) => {
  console.log ("DanteWiki Extension content.js sees a paste event", event);

  event.preventDefault();        // should do this before any async activities

  // the following two lines are for use during development only - also check the above CAVE for this since after the await the data is GONE
  // await analyzerClipboard ();  // this should be second

  synchronousEventAnalyzer (event);

  let types =  Array.from(event.clipboardData.types);
  let files =  Array.from(event.clipboardData.files);
  let items =  Array.from(event.clipboardData.items);

  console.warn ("++++ creating overlay now for types: " + JSON.stringify (types));
  OVERLAY.create ( "table", "Select paste insertion" );

  console.log ("after overlaycreation items are ", items);

  items.forEach ( (item, idx) => {
    if (item.kind === "file") {
      const file = item.getAsFile();
      console.log("Pasted file:", file);

      if ( file.type.startsWith("image/") ) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        OVERLAY.addRow (item.type, img);
      }
    }
    else if (item.kind === "string" ) {
      let txt = event.clipboardData.getData ( item.type );
      // console.log ("adding choice to selection overlay: ", item.type, txt);
      OVERLAY.addRow (item.type, txt);
    }

    else {console.warn ("Found weird kind: ", item.kind);}

  });  // iterating items


  OVERLAY.addCancel();  // only adds a further button 
  let selection = await OVERLAY.promisedSelection ("selectionText");
  OVERLAY.close ();
  
  if (!selection) { console.log ("User canceled"); 
 
    return;} 
  else {console.log ("User selextion amounted to text: " + selection);}

  insertAtCursor (selection);

// TODO: still need code parts, take out for the moment
/*

  for (const item of items) {  // TODO: does this really work in cases where we have mor ethan one item? and how are moultiple images then named ??
    if (item.type.startsWith('image')) {
      const blob = await item.getType(type); 
      const fileName = prompt("Enter file name to use on upload or cancel to abort upload");  // TODO: what if file name already used ?????
      if (fileName !== null) { console.log("User entered:", fileName); } 
      else                   { console.log("User cancelled"); }
      chrome.runtime.sendMessage({ action: 'upload_file', file: blob, fileName });  // Send blob to background script for uploading
      let txt = "[[File:"+fileName+"]]";
      injectText ( event, txt );
    }

    if (item.type.startsWith ("text")) {
      console.log ("PASTE event sees as mimetype: ", item.type);
      let txt = await item.getAsString ("string");  // TODO: maybe conversion of text formats ?? 
      injectText ( event, txt );
    }  // end MIME type text detection
  }
*/
});





const sanitizeFilename = (input) => {
  // Allowed characters: letters, digits, space, some punctuation, Unicode
  // Disallowed: # ? % : / \ * | < > " control chars, leading/trailing space or dot
  const forbiddenPattern = /[\/\\\*\|<>\?#%:"\u0000-\u001F]/g;
  const trimmed = input.trim();
  let sanitized = trimmed.replace(forbiddenPattern, '_');    // Replace forbidden characters with _
  sanitized = sanitized.replace(/ /g, '_');                  // Replace spaces with _
  sanitized = sanitized.replace(/^\.+|\.+$/g, '');           // Remove leading/trailing dots (can confuse filesystems)
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(sanitized);    // MediaWiki expects a file extension (e.g. .jpg) to validate upload
  return sanitized;
}





document.addEventListener ('drop', async (event) => {
  event.preventDefault();
  let content = synchronousEventAnalyzer (event);
  console.log ("drop event sees countent for upload", content, " counter is at ", content.COUNTER.get());

  if (content.collectFiles.length > 0) {  // TODO: instead of windo settimeout for arbitrary value couple this to COUNTER 
    window.setTimeout ( () => {console.log ("counter NOW is at ", content.COUNTER.get());
      executeUI (content);
      }, 500 );
  }
  else { console.warn ("nothing to insert found in drop event");}

}); // drop handler



// TODO: we must prevent a number of files from being accepted here, such as .DS-files appleDouble applesingle  dot files and similar rubbish

const executeUI = async (content) => {  // UI for upload of multiple items at the same time
  OVERLAY.create ( "column", "Adjust or enter filenames");

  content.collectFiles.forEach ( obj => {
    obj.name = sanitizeFilename (obj.name);    // TODO: might want to include path - in case the path placys a role or should be part of the information
    obj.identification = getNonce();
    let infoLine = `<input type='text' value='${obj.name}'></input> at ${obj.path}  ${obj.file.size} and ${obj.file.size > 1 ? 'FILE OK' : 'FILE BROKEN' }`;
    OVERLAY.addDiv ( infoLine, obj.identification ) ; 
  } );


  let choice = await OVERLAY.waitForModal ( ["Execute Upload", "Cancel Upload"] );
  if      (choice == 0) {}
  else if (choice == 1) { console.log ("Canceling upload"); OVERLAY.close(); return ; }

  OVERLAY.setTitle ("Wait for completion of uploads...");

  let still = content.collectFiles.length;  // items still to be worked on
  let errs  = 0;                            // items which were in error

  content.collectFiles.forEach ( obj => { console.log ("Object seen is: ", obj);
    let fileName = obj.name;  // TODO: must be sanitized for mediawiki and must be filled in by user if not provided 
    obj.file.arrayBuffer().then( async (buffer) => {                     // console.log ("Buffer ", buffer);
      let uint8 = new Uint8Array (buffer);                               // console.log ("uint8 array ", uint8);
      let response = await chrome.runtime.sendMessage({ action: "upload_file", buffer: [...uint8], mimeType: obj.type, fileName: fileName, identification: obj.identification}); 
      console.log ("response to upload request is ", response);
      console.log ("details are ", response.details.wiki.upload);
      const identification = response.details.identification;   // retrieve id of response
      console.log ("identification found in response ", identification);

      let textResponse = "  Response: " + response.details.wiki.upload.result;
      if (response.details.wiki.upload.result == "Warning") {textResponse += "<b style='color:red;'>"+ JSON.stringify (response.details.wiki.upload.warnings) + "</b>"; errs++; }

      OVERLAY.appendDiv ( textResponse , identification);
      still--;  // TODO: currently this does not allow a reasonable reaction or view of users when errors occur - not enough time to view all errors as we count all as ok.

      if (still == 0) {  // all have been completed
        if (errs != 0) { // if there was an error: offer a closing button and wait for it being pressed
          OVERLAY.setTitle ("Some uploads could not be completed");
          await OVERLAY.waitForModal ( ["Close" ]);}  
        OVERLAY.close();                                            // in both cases: close overlay
      }


   } ) ;

  // CAVE: the iteration as in [...uint8] is essential since we want to send an iterable array and not an object
  // CAVE: a blob is not transferabel, must convert it into an arraybuffer first
  // CAVE: an arraybuffer is to abstract for correct address increment, must convert it into Uint8Array before sending

  });




}



const getNonce = () => { let array = new Uint8Array (16); crypto.getRandomValues(array); return Array.from(array, b => b.toString(16).padStart(2, '0')).join(''); };






// service function listing a directory
const analyzeDirEntry = (dirEntry, collect, counter) => {  // Function to read the contents of a directory
  const directoryReader = dirEntry.createReader();
  directoryReader.readEntries((entries) => {
    console.group ("Directory named= " + dirEntry.name + "  at= " + dirEntry.fullPath + "  with " + entries.length + " entries in " + dirEntry.filesystem, dirEntry);
    entries.forEach((entry) => { if (entry.isDirectory) { analyzeDirEntry (entry, collect, counter);} else { analyzeFileEntry (entry, collect, counter); }
    });
  });
  console.groupEnd();
};


// analyze a file system entry
const analyzeFileEntry = (entry, collect, counter) => {
  if (entry.isDirectory)        {throw new Error ("Assertion Error: Entry is a directory");}
  if (!entry.isFile)            {throw new Error ("Assertion Error: Entry is not a file");}
  console.log ("File entry, name= " + entry.name + "  at " + entry.fullPath + " in " + entry.filesystem );
  let obj = {name: entry.name, path: entry.fullPath, file: null};  // file: null is a marker that the file has not yet been filled in
  if (collect) {collect.push ( obj );}
  counter.inc();
  entry.file ( file => { obj.file = file; counter.dec(); });  // now patch the value in
};


const analyzeFile = (file, collect) => {
  console.log ("  File name=" + file.name + "  size= " + file.size + "  type= " + file.type + 
               "\n  lastModified= " + file.lastModified + " or " + file.lastModifiedDate + " and path= " + file.webkitRelativePath, file);
  // if (collect) {collect.push (file);}  // TODO: not yet clear how we collect files in this situation where we have no names ????
};


// Function which does a completely and fully snchronous analysis of a paste event
// The problem is:
//   1) The getAsString function is callback based and there is no promise or await version of it
//   2) When moving to an await version we need to change executional context
//   3) Changing executional context destroys data transfer properties on an event
//      So retrieval must be done in a purely synchronous function
//

function synchronousEventAnalyzer (event) {

  // sometimes we face APIs in the analyzer which use callbacks
  // changing to a different API (such as promises and await) leads to new executional context where, sometimes, events are lost
  // this is intentional and correct behavior of the API as datatransfer then would allow for race conditions with the user
  // however as result we do not know how long to wait until all pending callback activities are completed
  // to be able to do so, we use COUNTER. inc adds 1 when an activity with a callback is generated, dec decrements the counter on completion
  // when get returns 0, all of them are completed
  const COUNTER = (()=>{
    let val=0;
    const inc = () => {val++;};
    const dec = () => {val--;};
    const get = () => val;
    return {inc, dec, get}
  })();

  let collectFiles = [];  // collects file objects we might consider for an upload

  console.group ("Analyzing " + event.type.toUpperCase() + " Event", event);

  let data;  // will be picked up as the suitable transfer object, depending on event type
  switch (event.type) {
    case "drop":     data = event.dataTransfer;  
                     console.log (`dropEffect= ${data.dropEffect} effectAllowed= ${data.effectAllowed}`);
                     break;
    case "paste":    data = event.clipboardData; break;
    default:         console.error ("not yet implemented type " + event.type);
  }

  // list the types
  console.log ( data.types.length + "  Types: ", data.types);

  // iterate the ITEMS
  console.group (data.items.length + "  ITEMS: ", data.items);
  const items = data.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "string") {    // CASE: kind=string
      let asDataTyped  = data.getData ( items.type );
      let asDataText   = data.getData ( "text" );
      console.log ("Item is a " + item.kind + " of type= " + item.type +"\n  asDataTyped: " + asDataTyped + "\n  asDataText: "+asDataText); 
    } else if (item.kind === 'file') {  // CASE: kind=file
      let entry;
      if ( item.webkitGetAsEntry && (entry=item.webkitGetAsEntry()) ) {  // MAY be interpreted as file system entry (most likely a finder drop)
        if (entry.isDirectory) { analyzeDirEntry (entry, collectFiles, COUNTER); }  else  { analyzeFileEntry (entry, collectFiles, COUNTER); } 
      } else {                                                           // MAY NOT be interpreted as file system entry (most likely a paste event)
        const myFile = item.getAsFile();
        analyzeFile (myFile, collectFiles);
      }
    } else { console.error ("Item has illegal kind: " + item.kind, item);}  // CASE: other
  }  // iterating items
  console.groupEnd (); // closes items group

  // iterate the FILES
  const files = data.files;
  console.group ( data.files.length + " FILES: ", data.files);  ////// TODO: these files also check for directory - rather not, will not have ????
  for (let i = 0; i < files.length; i++)  {
    let file = files[i];
    console.log ("File has  name= " + file.name + "  size= " + files.size + "  type= " + files.type + "  lastModified= " + file.lastModified + " (" + file.lastModifiedDate + ") path " + file.webkitRelativePath, file);
    
    const blob = new Blob([file], { type: file.type });
    console.log ("blob is", blob);

   //  collectFiles.push ( {name: "unknownNameMaybePasted", path: "unknownPathMaybePasted", blob: blob} ); 
  }

  console.groupEnd ();  // closes file group

  console.groupEnd ();  // closes analyzer group

  return {collectFiles, COUNTER};

}




// NOTE: reading the clipboard requires a content page to be focused and must be initiated by a user gesture
//       reading the past event comes for free - and contains more items in some occasions
async function analyzerClipboard () {
  let clipboardItems;
  let clipboardText;

  try {clipboardItems = await navigator.clipboard.read();} 
  catch (err) { console.warn (err);console.error ("could not read() from navigator.clipboard"); return;}

  try {clipboardText = await navigator.clipboard.readText();}
  catch (err) { console.warn (err); console.warn ("could not readText() from navigator.clipboard");}

  let numberTxt = "The clipboard contains " + clipboardItems.length + " items";
  let report = [];    // collects information objects for every clipboard item
  let itemNum = 0;
  for (const item of clipboardItems) {
    let one = {};            // report object for this item

    one.types = item.types;  // will be an array
    one.presentationStyle = item.presentationStyle;
    one.blobs = {};  // mapping types to blob of that type
    one.blobsTxt = {};  // mapping types to blob of that type, then serialized as text
    for (const type of item.types) {
      console.log ("retrieving blob for item " + itemNum + " under type= " + type);
      one.blobs[type] = await item.getType (type);
      console.log ("DONE:  blob for item " + itemNum + " under type= " + type+ " has size " + one.blobs[type].size + " and type " + one.blobs[type].type);
      one.blobsTxt[type] = await (one.blobs[type].text());
    }
    report.push (one);
    itemNum++;
  }

  console.group ("Analysis of the clipboard structure");
  console.log (numberTxt);
  for (let i=0; i < report.length; i++) {
    let obj = report[i];
    console.log ("Item " + i + " supports " + obj.types.length + " types, namely " + JSON.stringify (obj.types));
    for (const type of obj.types) {
      console.log ("  type " + type + " resolves to blobType " + obj.blobs[type].type + " having size " + obj.blobs[type].size + " and textual representation as " +obj.blobsTxt[type]);
    }
  }
  console.groupEnd ();

}



// TODO: migrate Overlay into DanteWiki basic code as we also need this for the category editing currently in DanteTree

// TODO: need an ESC for closing
// Need a button for closing TODO
// create a div which is acting as a selection overlay
// sels is an array of strings from which we select in the overlay

// NEW GENERATION OVERLAY
const OVERLAY= (()=>{

let overlay;      // the overlay element itself, overlaying the entire UI surface
let container;    // the container of the interaction elements

const create = ( mode, title ) => {
  overlay = document.createElement('div');
  Object.assign (overlay.style, {position: "fixed", top:"0", left: "0", width: "100vw", height: "100vh", zIndex: '9999', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' });
  Object.assign (overlay.style, {backgroundColor: 'rgba(0,0,0,0.5)' });

  // create a container inside of the overlay
  if (!mode || mode == "row") {
    container = document.createElement('div');
    Object.assign (container.style, {background: 'white', padding: '20px', borderRadius:'8px', boxShadow: '0 0 10px rgba(0,0,0,0.3)', display:'flex', flexDirection:'row' });
    container.innerHTML = "<h3 id='overlay-title'>"+title+"</h3>";
  }

  else if (mode =="column") {
    container = document.createElement('div');
    Object.assign (container.style, {background: 'white', padding: '20px', borderRadius:'8px', boxShadow: '0 0 10px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column' });
    container.innerHTML = "<h3 id='overlay-title'>" + title + "</h3>"; 
  }
  else if (mode == "table") {
    container = document.createElement ('table');
    Object.assign (container.style, {padding: '5px;', background:'white'});
  }

  overlay.appendChild(container);      // append the container to the overlay
  document.body.appendChild (overlay); // append the overlay to the entire document
};


const setTitle = (title) => {
  const titelEle = document.getElementById ("overlay-title");
  if (titelEle) titelEle.innerHTML = title;
};


const addInfoLine = (txt) => { // adds a textline
  const cont = document.createElement ("div");
  const textNode = document.createTextNode (txt);
  cont.appendChild (textNode);
  container.append (cont);
};

// adds a div to the container with html content and with an id through which we can reidentify
const addDiv = (html, id) => {
  const cont = document.createElement ("div");
  cont.id = id;
  cont.innerHTML = html;
  container.append (cont);
};

// appends to the div identified by id the html given by html
const appendDiv = (html, id) => {
  const ele = document.getElementById (id);
  ele.innerHTML += html;
};




const add = (sel) => {   // add an interaction element for the option with text  sel
  const btn     = document.createElement('button');
  btn.innerText = sel;
  btn.dataset.selectionType = sel;
  btn.style.margin = '10px';
  container.appendChild(btn);
};

const addTextarea = (sel, txt) => {
  const ta   = document.createElement ('textarea');
  ta.setAttribute ("rows", 5);
  ta.setAttribute ("cols", 60);
  ta.dataset.selectionType = sel;
  ta.value=txt;
  container.appendChild (ta);
}


const addRow = (sel, txt) => {
  const row = document.createElement ('tr');

  const btn     = document.createElement('button');
  btn.innerText = sel;
  btn.dataset.selectionType = sel;
  btn.dataset.selectionText = txt;
  Object.assign (btn.style, {margin: '10px'}  );
  // btn.style.margin = '10px';
  const btnTd = document.createElement ('td');
  Object.assign (btnTd.style, {padding: '5px'});
  btnTd.appendChild (btn);


  if (typeof txt == "string") { 
    const ta   = document.createElement ('textarea');
    ta.setAttribute ("rows", 5);
    ta.setAttribute ("cols", 60);
    ta.dataset.selectionType = sel;
    ta.value=txt;
    const taTd = document.createElement ('td');
    Object.assign (taTd.style, {padding: '5px'});
    taTd.appendChild (ta);

    btn.connectedTextarea = ta;

    row.appendChild (btnTd);
    row.appendChild (taTd);
    container.appendChild (row)
  }
  else if (txt instanceof HTMLImageElement) {
    const taTd = document.createElement ('td');
    Object.assign (taTd.style, {padding: '5px'});
    taTd.appendChild (txt);
   row.appendChild (btnTd);
    row.appendChild (taTd);
    container.appendChild (row)


  }
  else { console.error ("unknown thing in content.js: ", txt);}
};


const addCancel = () => {    // add a button for cancelation (identified as cancelation button as it has no dataset)
  const cancel  = document.createElement ('button');
  cancel.innerText = "Cancel";  //
  Object.assign (cancel.style, {margin: '10px'});
  container.appendChild (cancel);
};
 

// shows several buttons and returns promise that one of them will be pressed
// as soon one of them is pressed, all are removed and promise resolves to the index of the chosen one
const waitForModal = ( arr ) => {
  return new Promise (  (resolve, reject ) => {
    let all = [];
    arr.forEach ( (txt, idx)  => {
      let btn = document.createElement ('button');
      all.push (btn);
       btn.innerText = txt; 
      Object.assign (btn.style, {margin: '10px'});
      container.appendChild (btn);
      btn.addEventListener ("click", ()=> {  all.forEach (node=>node.remove());  resolve(idx); } );
    });
  });
};


const promisedSelection = async (datasetKey) => {    // promises to wait for a user click on any button
  return new Promise ( (resolve, reject) => {
    overlay.addEventListener ('click', function onClick(e) {  // console.log ("overlay click event was ", e, e.target, e.target?.dataset?.selectionType);
      if (! (e.target instanceof HTMLButtonElement) ) { /* console.log ("target was not button, returning"); */ return;}
      let txt = e.target.connectedTextarea.value; // get the text from the conected textarea   // TODO: maybe do this more elegant ???
      resolve (txt);
    } );
  });
};

const close = () => {overlay.remove (); };

return {create, add, promisedSelection, addCancel, addTextarea, addRow, addInfoLine, addDiv, appendDiv, close, setTitle, waitForModal};

})();


// OLD GENRATIOn OVERLAY
function createOverlay (sels) {
  const overlay = document.createElement('div');
  Object.assign (overlay.style, {position: "fixed", top:"0", left: "0", width: "100vw", height: "100vh", zIndex: '9999', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' });
  Object.assign (overlay.style, {backgroundColor: 'rgba(0,0,0,0.5)' });

  const container = document.createElement('div');
  Object.assign (container.style, {background: 'white', padding: '20px', borderRadius:'8px', boxShadow: '0 0 10px rgba(0,0,0,0.3)' });
  container.innerText = 'Choose clipboard format:'
  overlay.appendChild(container)

  sels.forEach(sel => {  // for every option add a button
    const btn     = document.createElement('button');
    btn.innerText = sel;
    btn.dataset.selectionType = sel;
    btn.style.margin = '10px';
    container.appendChild(btn);
  });

  // add a button for cancelation
  const cancel  = document.createElement ('button');
  cancel.innerText = "Cancel";  //
  Object.assign (cancel.style, {margin: '10px'});
  container.appendChild (cancel);

  return overlay;
}


// promise to obtain a choice selection from the user
// if the execution gets cancelled (by ESC) then it is called with NULL.
function performSelectionOverlay (sels) {
  return new Promise ( (resolve, reject) => {
    let overlay = createOverlay ( sels );   // create overlay
    document.body.appendChild(overlay);     // display overlay

    overlay.addEventListener ('click', function onClick(e) {
      console.log ("overlay click event was ", e);
      console.log ("overlay user selection was", e.target?.dataset?.selectionType);
      overlay.remove();
      overlay.removeEventListener('click', onClick);
      resolve (e.target?.dataset?.selectionType);
    } );
  });
}


// NOW we need a function for pasting text which we selected in the Overlay
// This function should also support 1) triggering events for DantePresentation and 2) browser native undo/redo
// Problem is: Both work with document.execCommand (but this is marked deprecated)
// Directly setting textarea.value does not work
// setRangeText works but does not seem to place this on to the undo stack of the browser 

function insertAtCursor (text) {
  insertAtCursor1(text);
}


function insertAtCursor1 (text) {  // works fully but execCommand is deprecated
  const textarea = document.getElementById("wpTextbox1");
  textarea.focus();
  textarea.setSelectionRange(textarea.selectionStart, textarea.selectionEnd);   // Select the current range
  const success = document.execCommand("insertText", false, text);              // Use execCommand
  console.log("Insert successful:", success);
}


function insertAtCursor4 (text) {
  const target = document.getElementById("wpTextbox1");
  target.focus();
  const start = target.selectionStart;
  const end   = target.selectionEnd;
  target.setRangeText(text, start, end, 'end');

  // Dispatch an input event to mimic real typing (optional but recommended)
  target.dispatchEvent (new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text } ) );
}






// extract the URL from an HTML snippet containing an image
function extractURL (input) {
  const parser = new DOMParser();  // Use a DOMParser to safely parse the HTML string
  const doc = parser.parseFromString(input, 'text/html');
  const img = doc.querySelector('img');  // Find the <img> element and extract its 'src' attribute
  const src = img ? img.src : null;
  return src;
}


chrome.runtime.onMessage.addListener( (message, sender, sendResponse) => {
  console.log ("*** *** content script received", message);

  switch (message.action) {
    case 'get_tab_size':   // content script was asked to report its size
      console.log ("window size is", window.innerWidth, window.innerHeight);
      sendResponse ( {width: window.innerWidth, height: window.innerHeight } );
      break;

    case 'get_clipboard_info':  // content script was asked to supply compact clipboard information
      // clipboard information is an array of arrays with types
      console.log ("content script was asked about clipboard");
      (async () => {
        let cli= [];  // clipboard information object (must be formed since the cblipboard objects themselves are not serializable)
        let items = await navigator.clipboard.read();     // obtain clipboard items, usually 0 or 1, may be more
        console.log ("content got clipboard items", items);
        items.forEach ( item => {                         // iterate the items
          let typeInfo = [];
          item.types.forEach ( type => {
            typeInfo.push (type);
           });
          cli.push (typeInfo);
        });
        console.log ("content script collected clipboard info", cli);
        sendResponse ( {action: "got_clipboard_info", param: cli} );
        console.log ("content script replied with clipboard info", cli);
      })();  // end async activity
      return true;  // signal caller that async response will be coming
  }

});


console.log('✅ DanteWiki: Content script injected and running.');