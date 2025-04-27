

export const WIKI="https://localhost:4443/wiki-dir/";  // TODO: should be set in options page !!
export const DOMAIN = "localhost";


import {setStatus} from "/js/status.js";

chrome.storage.local.set ( { WIKI, DOMAIN}, () => {console.log('Value stored!');});


// returns JSON !
export async function fetchWithTimeout (url, options = {}, timeout = 10000, clearTextError) {
  const controller = new AbortController();
  if (!clearTextError) {clearTextError = url;}  // if no clearTextError message is given, use url in the error message displayed
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    console.log ("calling fetch at " + url);
    const response = await fetch(url, {...options, signal: controller.signal });
    if (!response.ok) { console.watn ("fetch failed"); throw new Error(`Server error on ${clearTextError}: ${response.status} ${response.statusText}`); }
    else { console.log (`fetch succeeded with ${response.status}: ${response.statusText}`);}
    console.log ("response object is ", response); console.log ("response.json is ", response.json);
    let ret = await response.json();
    return ret;
  } catch (error) {
    if (error.name === 'AbortError') {console.warn('Fetch timed out ' + clearTextError); throw new Error ( "Fetching " + clearTextError + " timed out ");} 
    else {console.warn('Fetch failed:', error); throw new Error ("Fetching " + clearTextError + " failed with error");}
    ; 
  } finally { clearTimeout(id); }
}





// resolves to
//   null        anonymous user
//   username    otherwise
export async function getUser () {
  console.log ("Will check logon status and get user for: " + WIKI);
  setStatus ("waiting");
  let URL = WIKI + "/api.php?action=query&meta=userinfo&format=json";

  try {
    let data = await fetchWithTimeout ( URL, { method: 'POST'}, 10000, "user info" );
    console.log ("getUser: Got reply", data);
     // use a "POST", because we want the client to send an Origin header in the request
    // the origin header must be sent to allow the server proper handling of the CORS situation according to the Access-Control-Allow-Origin settings
    console.log ("------------ full  ", data);
    let userinfo = data?.query?.userinfo;
    if (userinfo.id === 0) { return Promise.resolve (null);          }
    else                     { return Promise.resolve (userinfo.name); }
  } catch (x) { console.error ("getUser sees error");console.error (x); throw x;   // log and rethrow
  }
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


