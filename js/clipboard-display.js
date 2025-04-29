


// TODO: do we still need this?????
window.addEventListener('load', () => {
  if (window.opener) {window.opener.postMessage('ready', '*'); }
  else {alert ("no opener");}
});

// display key, val objects
window.addEventListener('message', (event) => {
  console.log('Received message:', event.data)

  let div = document.getElementById ("clipDisplay");

  if (typeof event.data == "string") {                // displays strings
    let cont = document.createElement ("div");
    cont.classList.add("text-container");
    let txt = document.createTextNode (event.data);
    cont.appendChild (txt);
    div.appendChild (cont);
  }

  else if (typeof event.data == "object" && event.data.key) {  // displays key and val as textnode
    let cont = document.createElement ("div");
    cont.classList.add ("obj-container");
    let key = document.createElement ("b");
    key.innerHTML = event.data.key;
    let br = document.createElement ("br");
    let val = document.createTextNode (event.data.val);
    cont.appendChild (key);
    cont.appendChild (br);
    cont.appendChild (val);
    div.appendChild (cont);
  }

  else if (typeof event.data == "object" && event.data.html) { // displays html as html
    let cont = document.createElement ("div");
    cont.classList.add ("html-container");
    cont.innerHTML = event.data.html;
    div.appendChild (cont);
}





  // You can also check event.origin for security
});


console.log ("CLIPBOARD DISPLAY LOADED!");


