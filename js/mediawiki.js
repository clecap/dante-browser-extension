

export const WIKI="https://localhost:4443/wiki-dir/";  // TODO: should be set in options page !!
export const DOMAIN = "localhost";


export const extractDomain = url => {
  try {
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {normalizedUrl = 'https://' + normalizedUrl;}
    const parsedUrl = new URL(normalizedUrl);
    return parsedUrl.hostname;
  } catch (error) {
    console.error('Invalid URL:', url);
    return null;
  }
}

export const removeQuery = url => {
  try {
    const parsed = new URL(url);
    parsed.search = ''; // Remove the query part
    return parsed.toString();
  } catch (error) {
    console.error('Invalid URL:', url);
    return url;
  }
}



import {setStatus} from "/js/status.js";

chrome.storage.local.set ( { WIKI, DOMAIN}, () => {console.log('Value stored!');}); // TODO

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
  // console.log ("Will check logon status and get user for: " + WIKI);
  setStatus ("waiting");
  let URL = WIKI + "/api.php?action=query&meta=userinfo&format=json";

  try {
    let data = await fetchWithTimeout ( URL, { method: 'POST'}, 10000, "user info" );
    // console.log ("getUser: Got reply", data);
     // use a "POST", because we want the client to send an Origin header in the request
    // the origin header must be sent to allow the server proper handling of the CORS situation according to the Access-Control-Allow-Origin settings
    // console.log ("full  ", data);
    let userinfo = data?.query?.userinfo;
    if (userinfo.id === 0) { return Promise.resolve (null);          }
    else                     { return Promise.resolve (userinfo.name); }
  } catch (x) { console.error ("getUser sees error");console.error (x); throw x;   // log and rethrow
  }
}


// TODO: must still test situaiton of an override - what does the system do ??
async function checkFileExists (filename) {
  const title = 'File:' + filename;

  const url = new URL (WIKI + "/api.php");
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('titles', title);

  const response = await fetch(url, { method: 'GET', credentials: 'include'} );
  const data     = await response.json();
  const pages    = data.query.pages;
  const pageId   = Object.keys(pages)[0];    // If pageId is -1, the file does not exist

  return (pageId !== '-1');
}


async function getCsrfToken() {
  const response = await fetch( WIKI + "/api.php?action=query&meta=tokens&type=csrf&format=json");
  const data     = await response.json();
  return data.query.tokens.csrftoken;
}

// uploads a file to the dantewiki, given a blob and a fileName
export async function uploadFile (blob, fileName) {
  // console.log ("Mediawiki: Uploading blob of type= " + blob.type + " and size= " + blob.size + "  under name=" + fileName, blob);
  let token;
  let ret = {};  // collect response messages for a return value
  try {
    console.log ("*** waiting for token");
    token = await getCsrfToken();             // console.log ("*** got token", token);
    const formData = new FormData();          // console.log ("*** will prepare data");
    formData.append('action',  'upload');
    formData.append('filename', fileName);
    formData.append('file',     blob);
    formData.append('token',    token);
    formData.append('format',  'json');       // console.log ("*** Will now fetch");
    const response = await fetch ( WIKI + '/api.php', { method: 'POST',  body: formData, credentials: "include" });
    // console.log ("*** Fetch returned ", response);
    ret.wiki       = await response.json();
    // console.log ("***** Response of dantewiki is: ", ret.wiki);
  } catch (err) {
    console.error ("Uploading saw error", err);
    ret.exception = err;
  } finally { return ret; }

}
