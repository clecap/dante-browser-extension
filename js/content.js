// this not available in here, use globalThis instead (according to LLM)



// content page sees a paste 
// paste may be the consequence of a mouse action or of a keyboard action - should treat different TODO
document.addEventListener('paste', async (event) => {
  console.log ("DanteWiki Extension content.js sees a paste event", event);

  event.preventDefault();        // should do this before any async activities

  // the following two lines are for use during development only 

  // analyzerEvent (event);     // NO async - reason explaind below; has 2 sec timeout - so after it we wait before doing more analysis !
  // await analyzerClipboard ();  // this should be second

  let types = Array.from(event.clipboardData.types);         // this version gets the types from event.clip



  console.warn ("++++ creating overlay now for types: " + JSON.stringify (types));
  OVERLAY.create();
  types.forEach (type => OVERLAY.add(type));
  OVERLAY.addCancel();
  let selection = await OVERLAY.promisedSelection();
  if (!selection) { console.log ("User canceled"); return;} else {console.log ("User selected: " + selection);}

  let idx = types.indexOf(selection);
  console.log ("POST: ", event.clipboardData);
  console.log ("POST: ", event.clipboardData.items);
  event.clipboardData.items[idx].getAsString ( arg => {  
    console.log ("user selected " + selection + " resolves to " + content);
    insertAtCursor(content);
  } );
// items[i].getAsString ( arg => {itemText[i].asString = arg;} );


//  const content = event.clipboardData.getData (selection);

//  console.log ("user selected " + selection + " whose content is: " + content);
//  insertAtCursor(content);


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


console.warn ("-------------------------------------- paste is instrumented");


// analyzer function for an event which might come from a drag and drop or a paste/copy or a clipboard related event
function analyzerEvent (event) {

  console.group ("Analyzing Clipboard Event (may be interleaved with other console writes due to async character)");

  // inspecting the clipboadData of the event statically sinc eit changes throughout the process and console.log might not be current

  console.log ("Raw event: ", event);
  console.log ("Raw event.clipboardData:", event.clipboardData);
  

  console.log ( event.clipboardData.types.length + "  Types: ", event.clipboardData.types);
  console.log ( event.clipboardData.items.length + "  Items: ", event.clipboardData.items);
  console.log ( event.clipboardData.files.length + "  Files: ", event.clipboardData.files);

  const items = event.clipboardData.items;
  let itemText = new Array (items.length);   // maps number to text information of item 
  for (let i = 0; i < items.length; i++) {
    console.log ("Item " + i + " with kind= " + items[i].kind + " and type= " + items[i].type + " is: ", items[i]);
    itemText[i] = {};
    itemText[i].kind         = items[i].kind;
    itemText[i].type         = items[i].type;
    itemText[i].asString     = items[i].getAsString ( arg => {itemText[i].asString = arg;} );
    itemText[i].asDataTyped  = event.clipboardData.getData ( items[i].type );
    itemText[i].asDataText   = event.clipboardData.getData ( "text" );
  
    let myFile               = items[i].getAsFile();
    itemText[i].asFileName           = myFile?.name || "no file version obtained";
    itemText[i].asFileSize           = myFile?.size || "no file version obtained";
    itemText[i].asFileLastModified   = myFile?.lastModified || "no file version obtained";
    itemText[i].asFileType           = myFile?.type || "no file version obtained";
  }

  const files = event.clipboardData.files;
  let fileText = new Array (files.length);   // maps number to text information of item 
  for (let i = 0; i < files.length; i++)  {
    console.log ("File " + i + " is:", files[i]);
    console.log ("File " + i + "  name= " + files[i].name + "  size= " + files[i].size + "  type= " + files[i].type);
    console.log ("  lastModified= " + files[i].lastModified + " or " + files[i].lastModifiedDate + " and path " + files[i].webkitRelativePath);
  }


  // the construction is a bit involved
  // some fo the calls above are async and callback based, but if we convert them to promise based
  // we later have no access any more to the event and its clipboard items
  // thus we do an arbitrary setTimeout here for awaiting completion before reporting
  window.setTimeout ( () => {
    console.log ("Now presenting all info for " + itemText.length + " items ");
    for (let i = 0; i < itemText.length; i++)  {
      console.log ( "ITEM " + i + " is kind= " + itemText[i].kind  + " and type= ", itemText[i].type ); 
      console.log ("  asString", itemText[i].asString); 
      console.log ("  asDataTyped", itemText[i].asDataTyped  );
      console.log ("  asDataText", itemText[i].asDataText  );
      console.log ("  asFileType", itemText[i].asFileType );
  }
    console.groupEnd ();
  }, 2000);
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









// TODO: need an ESC for closing
// Need a button for closing TODO
// create a div which is acting as a selection overlay
// sels is an array of strings from which we select in the overlay

// NEW GENERATION OVERLAY
const OVERLAY= (()=>{

let overlay;      // the overlay element itself, overlaying the entire UI surface
let container;    // the container of the interaction elements

const create = () => {
  overlay = document.createElement('div');
  Object.assign (overlay.style, {position: "fixed", top:"0", left: "0", width: "100vw", height: "100vh", zIndex: '9999', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' });
  Object.assign (overlay.style, {backgroundColor: 'rgba(0,0,0,0.5)' });

  container = document.createElement('div');
  Object.assign (container.style, {background: 'white', padding: '20px', borderRadius:'8px', boxShadow: '0 0 10px rgba(0,0,0,0.3)' });
  container.innerText = 'Choose clipboard format:'
  overlay.appendChild(container);
  document.body.appendChild (overlay);
};


const add = (sel) => {   // add an interaction element for the option with text  sel
  const btn     = document.createElement('button');
  btn.innerText = sel;
  btn.dataset.selectionType = sel;
  btn.style.margin = '10px';
  container.appendChild(btn);
};

const addCancel = () => {    // add a button for cancelation
  const cancel  = document.createElement ('button');
  cancel.innerText = "Cancel";  //
  Object.assign (cancel.style, {margin: '10px'});
  container.appendChild (cancel);
};


const promisedSelection = async () => {    // promises to wait for a user click on a button
  return new Promise ( (resolve, reject) => {
    overlay.addEventListener ('click', function onClick(e) {
      console.log ("overlay click event was ", e);
      console.log ("overlay user selection was", e.target?.dataset?.selectionType);
      overlay.remove();
      overlay.removeEventListener('click', onClick);
      resolve (e.target?.dataset?.selectionType);
    } );
  });
};

return {create, add, promisedSelection, addCancel};


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




function insertAtCursor(text) {
  console.warn ("insertAtCursor: " + text);
  const activeEl = document.activeElement
  if (activeEl.isContentEditable) {
    const sel = window.getSelection()
    if (!sel.rangeCount) return
    sel.deleteFromDocument()
    sel.getRangeAt(0).insertNode(document.createTextNode(text))
  } else if (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') {
    const start = activeEl.selectionStart
    const end = activeEl.selectionEnd
    const value = activeEl.value
    activeEl.value = value.slice(0, start) + text + value.slice(end)
    activeEl.selectionStart = activeEl.selectionEnd = start + text.length
  }
}






























// inject the text txt at the current cursor position of the element currently receiving keyboard input
function injectText ( event, txt ) {
  const target = document.activeElement;

  // is that element capable of textual input?
  const isTextInput = (target.tagName === 'TEXTAREA') ||
                      (target.tagName === 'INPUT' && target.type === 'text') ||
                       target.isContentEditable;
  if (!isTextInput) { console.warn ("Current element not capable of text input, it is:", target); return;}

  event.preventDefault();

  if (target.isContentEditable) {      // For contenteditable elements
    const selection = window.getSelection();
    if (!selection.rangeCount) { console.warn ("Currently no range is selected for a paste"); return;}
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode (txt));
  } else {                            // For input or textarea elements
    const start  = target.selectionStart;
    const end    = target.selectionEnd;
    const value  = target.value;
    target.value = value.slice(0, start) + txt + value.slice(end);
    target.setSelectionRange(start + txt.length, start + txt.length);
  }

      this.setSelectionRange(selectionStart + txt.length, selectionStart + txt.length);    // Move cursor to end of inserted text
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