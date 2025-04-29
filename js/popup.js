import {displayUser} from "/js/status.js";

document.getElementById('capture-btn').addEventListener('click', async () => {
  console.log ("Sending message to backend for capturing...");
  chrome.runtime.sendMessage({ action: 'capture_tab' });
});



// CAVE: a clipboard item cannot be JSOn serialized ! // TODO: deprecate???
async function serializeClipboardItem(item) {
  const types = item.types;
  const result = {};

  for (const type of types) {
    const blob = await item.getType(type);
    const text = await blob.text();
    result[type] = text;
  }

  return result;
}





document.getElementById('show-clipboard-btn').addEventListener('click', async () => {
  let win = window.open ("../html/clipboard-display.html", "_blank", "width=600,height=800,left=100,top=100");  // open a fresh window

  let collect = [];   // array of objects {key: "label", val: "value for label"}
  try {
    const text = await navigator.clipboard.readText();
    console.log ("TEXT", text);
    collect.push ( "HELLO" );
    collect.push ( { key:"textTest", val: "TRYING" } );
    collect.push ( { key:"text", val: JSON.stringify (text) } );
    let items = await navigator.clipboard.read();
    console.log ("ITEMS", items);
    collect.push ( {key: "Number of clipboard items:", val: items.length} );
    let count = 0;
    items.forEach ( item => {
      collect.push ( {key: "Item number " + count + " supports types:", val: JSON.stringify (item.types) } );
    } );

    let html="";
    items.forEach ( (item, idx) => {
      html += `<b>Item ${idx}</b> of ${items.length} supports ${item.types.length} MIME types`;
      html += "<ol>";
      item.types.forEach ( typ => { html += `<li>${typ} </li>`}); 
    } );
    html += "</ol>";
    collect.push ( {html} );



    collect.push ( {key:"items", val: JSON.stringify (items)} );
    console.log ("COLLECT", collect);
  } catch (err) {
      console.error ('Failed to read clipboard: ' + err.message);
    }

  win.onload = async () => {   // wait until it is fully loaded
    console.log('New window is loaded!')
    collect.forEach ( ele => { win.postMessage (ele, '*') });
    console.log ("Message was posted");
  };




});





document.addEventListener('DOMContentLoaded', () => {
  console.log ("DOMContent loaded in document ", document);
  window.setTimeout ( () => {displayUser (document);}, 10);   // delay this a tiny bit to allow for latecoming info from backend

});









chrome.runtime.sendMessage({ action: 'popup_run' });

