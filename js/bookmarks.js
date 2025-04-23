// This file contains the bookmark related functions

const USING_CRYPTO = true;      // configure if we are using cryptography

import CRYPTO   from "./crypto.js";




async function getPassword () {
  let data = await chrome.storage.sync.get("AES_Password"); 
  return Promise.resolve (data.AES_Password)
}

let AES_Password = await getPassword();





// we want to use promises, since the tree of bookmarks requires some delicate sequencing (parents must have been constructed before constructing children
// and we need to know when everything has been completed as well)
// manifest v3 does not yet support promises in bookmarks
// THUS: warp it
function createBookmark (bookmark) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(bookmark, (result) => { if (chrome.runtime.lastError) {reject(new Error(chrome.runtime.lastError));} else {resolve(result);} } );
  });
}

// TODO: move installSomeBookmarks upstairs ????
async function installBookmarks ( bookmarkData ) {
  let arr = await installSomeBookmarks (bookmarkData);
  return Promise.resolve (true);
}

// create some bookmarks and return a promise
// pid, if defined, is the id of the parent which muts be used here as the installed bookmarks got a fresh parent id while being installed dynamically
async function installSomeBookmarks (bookmarkData, pid) {  // console.log ("installing bookmarks data", bookmarkData);
  let promises = [];

  for (const bookmark of bookmarkData) {
    if (bookmark.folderType == "other") { /* console.log ("skipping other"); */ continue; }
    if (bookmark.parentId === undefined || bookmark.parentId === "0") {bookmark.parentId = "1";} 
    if (pid !== undefined) {bookmark.parentId = pid;}
    if (bookmark.children) {
      console.log (`BM: installing a node with ${bookmark.children.length} children \ntitle=${bookmark.title}, folderType=${bookmark.folderType}, id=${bookmark.id}, parentId=${bookmark.parentId} url=${bookmark.url}`, bookmark);
      try {
        let created = await createBookmark( {parentId: bookmark.parentId, title: bookmark.title, url: bookmark.url} );
        let p = await installSomeBookmarks (bookmark.children, created.id);
        promises.push ( p );
        // console.warn ("CREATED ", created);
      } catch (x) { console.error (x); console.error (`ERROR installing node with ${bookmark.children.length} children \ntitle=${bookmark.title}, folderType=${bookmark.folderType}, id=${bookmark.id}, parentId=${bookmark.parentId} url=${bookmark.url}`, bookmark);     }
    }
    else { console.log (`BM: installing a leaf node bookmark \ntitle=${bookmark.title}, folderType=${bookmark.folderType}, id=${bookmark.id}, parentId=${bookmark.parentId} url=${bookmark.url} `, bookmark);
      try {
        promises.push ( createBookmark ( {parentId: bookmark.parentId, title: bookmark.title, url: bookmark.url} ) );
      } catch (x) { console.error (x); console.error (`ERROR installing leaf node \ntitle=${bookmark.title}, folderType=${bookmark.folderType}, id=${bookmark.id}, parentId=${bookmark.parentId} url=${bookmark.url} `, bookmark); }
    }
  } // end for

  return Promise.all (promises);
} // end internal function
// '1' is the ID of the root folder












// API function: promises to clear all bookmarks on the bookmark bar
async function clearBookmarks () {                        // console.log ("clearing bookmarks");
  let bookmarkTree = await chrome.bookmarks.getTree();    // console.log ("got bookmarks tree ", bookmarkTree);
  const rootFolder = bookmarkTree[0];                     // console.log ("root folder is", rootFolder);
  try {
    if (rootFolder.children) { await deleteBookmarksTree(rootFolder.children); }
  } catch (x) { console.error (x);}
}


// Helper function: promises to clear several bookmark nodes
const deleteBookmarksTree = (bookmarkNodes) => new Promise((resolve, reject) => {
  let promises = [];
  bookmarkNodes.forEach(node => {
    if (node.children)         { promises.push ( deleteBookmarksTree ( node.children ) );}  // if node has children, remove them
    if (node.parentId === "0") {  console.warn ("skipping parentid 0"); }
    else {promises.push(deleteBookmark(node.id));}
  });
  Promise.all ( promises ).then(resolve).catch(reject); // resolve only when all deletions have taken place
} );


// Helper function: promises to clear one bookmark of the given id
// essentially transforms a single callback oriented chrome function into a promise based
const deleteBookmark = (bookmarkId) => new Promise((resolve, reject) => {
  chrome.bookmarks.remove(bookmarkId, () => {
    if (chrome.runtime.lastError) {reject(chrome.runtime.lastError);} else {resolve();}
    });
  } );



// promises to return a bookmark data structure where all tabs of the current / all windows are collected in  // TODO   also closing this / all windows --- need this also adapted in the GUI
// call with  query = { currentWindow: true}   for current window
// call with  query = {}     for all windows
function returnBookmarksFromQuery ( query ) {  /////////////////////// TODO: this structure still must be built up to correspond to the usual bbokmark tree structure 
  return new Promise ( (resolve, reject) => {
    // console.log ("Doing a tab query with query=" + JSON.stringify( query));
    chrome.tabs.query ( query, (tabs) => {
      // console.log ("Tab query returned "+tabs.length+ " tabs:", tabs);
      let tree = [];
      let rootNode = {};
      let barNode  = { children:[], folderType:'bookmarks-bar', id: "1", index:0, title:"Bookmarks Bar"};
      let otherNode = { children:[], folderType:'other'};
      tree = [rootNode];
      rootNode.children = [barNode, otherNode];

// TODO: if window has a name: inject this as folder name - if not, might use this 
// TODO: inside of window: if window has tabs: inject this as folder name

// parentId: using "1" for bar
      tabs.forEach ( tab => {
         let node = { title: tab.title, url: tab.url, parentId: "1"};
         console.log ("Pushing to barNode the node ", node);
         barNode.children.push ( node );
      } );


      resolve ( tree );
    });     
  });
}





// promises to resolve into a string representation of current browser bookmarks (may be encrypted)
async function getBookmarksAsString ( query ) {
  console.log ("getBookmarksAsString query=", query);
  let bookmarks; 
  if (query === null)      { bookmarks = await chrome.bookmarks.getTree ();          }
  else                     { bookmarks = await returnBookmarksFromQuery ( query );   }

  console.log ("Bookmark tree directly obtained from getTree", bookmarks);

  let bText     = JSON.stringify (bookmarks);
  let uploadText;
  if (USING_CRYPTO) {
    let cipher     = await CRYPTO.encryptData (AES_Password, bText);    // console.log ("result from encryption is ", cipher);
    uploadText     = JSON.stringify (cipher);                           // console.log ("encrypted upload ", uploadText);
  }
    else { uploadText = bText; }
  return Promise.resolve (uploadText );
}


// promises to install a string representation of bookmarks (possibly encrypted) to current browser bookmarks
// when encrypted:      expect an object {iv, encrypted} with a (public) initialization vector and an encrypted ciphertext
// when not encrypted:  expect only a string
async function putStringToBookmarks ( txt ) {
  let downloadObj;
  downloadObj = JSON.parse ( txt );             // console.log ("downloaded object", downloadObj);

  let bookmarks;
  if ( Object.hasOwn (downloadObj, "iv") ) {
    console.log ("initialization vector is ", downloadObj.iv, typeof downloadObj.iv, Array.isArray (downloadObj.iv));
    const bufferSource = new Uint8Array( Object.values (downloadObj.iv));                             // console.log ("initialization vector as bufferSource is ", bufferSource);   // must convert initialization vector into a buffer source.
    let plainText = await CRYPTO.decryptData ( AES_Password, downloadObj.encrypted, bufferSource );   //  console.log ("plaintext is ", plainText);
    bookmarks = JSON.parse (plainText);
  }
  else { bookmarks = downloadObj;}

  // console.log ("DOWNLOADED WAS: ", bookmarks);
  bookmarks = bookmarks[0].children;
  // console.log ("DOWNSTEP ", bookmarks);
  console.log ("will now install bookmarks, array has length " + bookmarks.length, bookmarks);
  let promises = [];
  for (let kid of bookmarks) { 
    console.log ("seeing kid", kid);
    if (kid.folderType == 'bookmarks-bar') { promises.push ( installBookmarks (kid.children) ); } }
  await Promise.all ( promises );   // wait for all changes to settle

  return Promise.resolve();
}




// TODO: not yet fully ready function
async function storeBookmarksToFilesystem () {
  let bookmarks = await chrome.bookmarks.getTree();
  let jsonData  = JSON.stringify(bookmarks, null, 2);

// dataUrl TODO maybe bad idea since size limited - do different
/*
    chrome.downloads.download({
      url: dataUrl,
      filename: "bookmarks.json",
      saveAs: true,
      conflictAction: uniquify,
      headers: [ {name: 'nonce', value: ''}, {name:'sig-nonce', value: ''} ]
    });
*/


}




export default { clearBookmarks, getBookmarksAsString, putStringToBookmarks };