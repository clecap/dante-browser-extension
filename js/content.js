// this not available in here, use globalThis instead (according to LLM)

// content page sees a paste 
// paste may be the consequence of a mouse action or of a keyboard action - should treat different TODO
document.addEventListener('paste', async (event) => {
  console.log ("DanteWiki Extension content.js sees a paste event", event);

// TODO: FILTER - should happen only if the current page is running dante
  // if it is a media type, offer an upload
// TODO: ALSO MUST ENSURE that if we do a copy somewhere we also get URL information as a reference to the source !!!!

  const items = event.clipboardData.items;
  for (const item of items) {  // TODO: does this really work in cases where we have mor ethan one item? and how are moultiple images then named ??
    if (item.type.startsWith('image')) {
      const file   = item.getAsFile();
      // TODO: note: file name might already be there - and URL as well ??????? from copy ??? also in case of CUT do the same 
      const fileName = prompt("Enter file name to use on upload or cancel to abort upload");  // TODO: what if file name already used ?????
      if (fileName !== null) {
        console.log("User entered:", fileName);
      } else {
        console.log("User cancelled");
      }

      // Send the file to the background script for upload
      chrome.runtime.sendMessage({ action: 'upload_file', file: file, fileName });

      // inject a suitable local anchor into the DanteWIki page - different if we are in a tex area - maybe allow choice ????

    }

    if (item.type.startsWith ("text")) {

    
/*
      const newText = "Hello Dante experiment"; // The text you want to paste instead

      const clipboardData  = event.clipboardData || window.clipboardData;   ////// ?!?!?! OK ?
      const selectionStart = this.selectionStart;
      const selectionEnd   = this.selectionEnd;

      // Insert text manually at the current cursor position
  */    


    const newText = '     Hello World alternative dantewiki text te';

    const target = document.activeElement;

      // Only intercept if focused element is editable
      const isTextInput = target.tagName === 'TEXTAREA' ||
                        (target.tagName === 'INPUT' && target.type === 'text') ||
                        target.isContentEditable;

      if (!isTextInput) { console.log ("no idea how to intercept the paste ");return;}

      event.preventDefault();

      if (target.isContentEditable) {      // For contenteditable elements
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(newText));
      } else {  // For input or textarea
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const value = target.value;
        target.value = value.slice(0, start) + newText + value.slice(end);
      target.setSelectionRange(start + newText.length, start + newText.length);
      }
       
// const oldValue = this.value;
 //       this.value = oldValue.slice(0, selectionStart) + newText + oldValue.slice(selectionEnd);

      // Move the cursor to the end of the inserted text
      this.setSelectionRange(selectionStart + newText.length, selectionStart + newText.length);


    }  // end MIME type text detection


  }
});





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