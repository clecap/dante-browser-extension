// This is the main background worker script

// #region *** IMPORTS ***
import { S3Client, ListBucketsCommand, ListObjectVersionsCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import BM       from "./bookmarks.js";

import {deleteAllVersionsFromS3, listKeysWithVersionCount, downloadStringFromS3, uploadStringToS3 } from "aws-s3.js";

// #endregion

const VERBOSE = false;

let AWS_ACCESS_KEY_ID;
let AWS_SECRET_ACCESS_KEY;
let AWS_DEFAULT_REGION;
let AWS_BUCKETNAME;

let s3Client;

// Get AWS credentials from storage
async function getAWSCredentials () {
  const keys = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION", "AWS_BUCKETNAME"];
  let data = await chrome.storage.sync.get(keys);             // console.log ("loaded credentials are",data);
    AWS_ACCESS_KEY_ID     = data.AWS_ACCESS_KEY_ID;
    AWS_SECRET_ACCESS_KEY = data.AWS_SECRET_ACCESS_KEY;
    AWS_DEFAULT_REGION    = data.AWS_DEFAULT_REGION;
    AWS_BUCKETNAME        = data.AWS_BUCKETNAME;
    s3Client = new S3Client({ region: AWS_DEFAULT_REGION,  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY } });  // console.log ("CLIENT IS ", s3Client);
  return Promise.resolve ( );
}






let M = (() => {  // functionality for synchronizing UI properly with internal state
  // NOTE: Some of the functions called here are async with callback mechanism only
  // NOTE: Raceconditions make it necessary to strictly wait since otherwise we get inconsistent status display

  // these three functions are callback-only. we want them promise-based to get more readable code
  const setIconAsync = (details) =>  new Promise ( (resolve, reject) => {
    chrome.action.setIcon ( details, () => { if (chrome.runtime.lastError) {reject(chrome.runtime.lastError);} else {resolve();} } ) } );

  const setBadgeBackgroundColorAsync = (details) => new Promise ( (resolve, reject) => {
    chrome.action.setBadgeBackgroundColor ( details, () => { if (chrome.runtime.lastError) {reject(chrome.runtime.lastError);} else {resolve();} } ) } );

  const createNotificationAsync = (id, options) => new Promise ( (resolve, reject) => {
    chrome.notifications.create ( id, options, (notificationId) => { if (chrome.runtime.lastError) {reject(chrome.runtime.lastError);} else {resolve(notificationId);} } ) } );

  const clearNotificationAsync = (id) => new Promise ( (resolve, reject) => {
    chrome.notifications.clear( id, (notificationId) => { if (chrome.runtime.lastError) {reject(chrome.runtime.lastError);} else {resolve(notificationId);} } ) } );

  // Global Status
  let enabled = true;
  let numberOfChanges = 0;             // total number of bookmark changes since last upload
  let notificationActive = false;      // keeps state of active notifications to cut down on number of times we call it to show

  // return a promise to execute an async function f after a delay of ms milliseconds
  // the promise resolves only after async function f has completed
  const delayAsyncExecution = (f, ms) => new Promise((resolve, reject) => {
    setTimeout( async () => {
      try {
        const result = await f();
        resolve(result);
      } catch (error) {reject(error);}
    }, ms);
    });


  const markDirty = async () => {
    if (!enabled) {return Promise.resolve ();}          // if not enabled: nothing to do

    numberOfChanges++;
    chrome.action.setBadgeText({ text: "" + numberOfChanges });  // up to 4 characters are shown; is fast and synchronous

    if (!notificationActive) {
      await setBadgeBackgroundColorAsync ({ color: "red" });    
      await setIconAsync ({ path: "../media/circle-red.png" }); 
      await createNotificationAsync ('lameNotification',        
        { type: 'basic', iconUrl: '../media/circle-red.png', title: 'Bookmarks have changed', message: 'Please remember to upload!', priority: 2, requireInteraction: true
        } );
      notificationActive = true;
    }
  }; // end markDirty


  // markClean is called after bookmark transactions have completed 
  // however the transactions we start programmatically also generate events for the event queue which have not yet been serviced
  // so we delay execution of this a bit to allow servicing of the event queue
  const markClean = async () => delayAsyncExecution ( async () => {
    numberOfChanges = 0;
    notificationActive = false;
    chrome.action.setBadgeText({ text: "OK" });
    await setBadgeBackgroundColorAsync ( { color: "green" } );
    await setIconAsync ( { path: "../media/bookmark.32.png" } ); 
    await clearNotificationAsync('lameNotification', wasCleared => {console.log ( wasCleared ? 'Notification cleared' : 'Failed to clear notification'); });
    }, 5 );

  const enable  = () => {enabled = true};
  const disable = () => {enabled = false};

  return {markDirty, markClean, enable, disable};
})();




// #region  *** Listen for all kinds of bookmark changes
chrome.bookmarks.onCreated.addListener ( (id, bookmark) => { M.markDirty();
  if (VERBOSE) console.log(`Bookmark created: id=${id}, bookmark.id=${bookmark.id} title=${bookmark.title}  url=${bookmark.url}`, bookmark);
});

chrome.bookmarks.onRemoved.addListener ( (id, parentId, index) => { M.markDirty();
  if (VERBOSE) console.log('Bookmark removed: id=', id, "parentid=", parentId, "index=", index);
});

chrome.bookmarks.onChanged.addListener ( (id, changeInfo) => { M.markDirty();
  if (VERBOSE) console.log('Bookmark changed:', id, changeInfo);
});

chrome.bookmarks.onMoved.addListener ((id, oldParentId, oldIndex, newParentId, newIndex) => { M.markDirty();
  if (VERBOSE) console.log('Bookmark moved:', id, oldParentId, oldIndex, newParentId, newIndex);
});


chrome.bookmarks.onImportEnded.addListener ( () => { M.markDirty();
  if (VERBOSE) console.log('Bookmark import completed');
});


chrome.bookmarks.onChildrenReordered.addListener ( function() { M.markDirty();
  if (VERBOSE) console.log('Bookmark children have been reordered');
});

// #endregion





// TODO maybe merke enable and markClean

// CAVE: The following is a bit tricky.
//   (1) We must return true in a synchronous manner to the component invoking this listener so that the remote port stays open for an asynchronous answer.
//       This true must be returned in a synchronous manner.
//   (2) We must ensure that we start an asynchronous activity which, eventually, will provide this asynchronous answer
//   (3) Inside of this asynchronous activity, we might need further await mechanisms for scheduling async activities inside of it
chrome.runtime.onMessage.addListener( (message, sender, sendResponse) => {   // This function MUST NOT be async, since we must return true or false in a synchronous fashion
  console.log ("Serviceworker got message ", message, " from sender ",  sender);
  let action = message.action, para=message.para, query=message.query;
  console.log ("..... action=" + action + " para=" +para+" query=" + JSON.stringify(query));

  switch ( action ) {
    case "down":             M.disable(); downloadBookmarksFromS3(message.para ).then( () => {M.enable(); M.markClean(); } );   return false;
    case "new":     // new is just the same task as up (we just get the command parameters from a different place)

    case "win":  case "winC":   case "all":   case "allC":

    case "up":    // CAVE: an upload changes the version number, so we must list as well
                  ( async () => {  // set up an asynchrnous activity
                    M.disable();   // TODO: really need this ????
                    let upload = await uploadBookmarksToS3(para, query)            // do an upload an wait until it is completed
                    let map    = await listKeysWithVersionCount();                 // do a listing and wait until it is completed
                    let converted =  Object.fromEntries (map);                     // convert listing, which is a map, into something serializable
                    console.log ("Serviceworker will be sending response. Unconverted map is ", map, " map converted to object is ", converted );  
                    sendResponse ( {answer:converted} );                           // use the provided callback function to send the reply  
                    M.enable(); M.markClean();
                    console.log ("done in service worker function, action was: " + action);
                    if (action == "winC") { const win = await chrome.windows.getCurrent(); await chrome.windows.remove(win.id); }
                    if (action == "allC") { const windows = await chrome.windows.getAll(); for (const win of windows) { await chrome.windows.remove(win.id); } } 
                  })();  // end of asynchronous activity
                  return true;    // sends a synchronous true to the other end that it keeps the port open

    case "listCount":   ( async () => {  // set up an asynchronous activity
                          let map = await listKeysWithVersionCount();
                          let converted =  Object.fromEntries (map); 
                          console.log ("Serviceworker sending response. unconverted ", map, "converted", converted );  
                          sendResponse ( {answer:converted} ); 
                        }) ();  // end of asynchronous activity
                        return true;
                            
    case "del":         ( async () => {  // set up asynchronous activity
                          await deleteAllVersionsFromS3( para );                   
                          console.log ("Serviceworker: Doing the listing after the deletion now");
                          let map = await listKeysWithVersionCount();
                          let converted =  Object.fromEntries (map); 
                          console.log ("Serviceworker sending response. unconverted ", map, "converted", converted );  
                          sendResponse ( {answer:converted} ); 
                        })();
                        return true;
    case "clearBookmarks":   
                        M.disable(); 
                        ( async () => {
                          await BM.clearBookmarks ();
                        M.enable(); M.markClean();
                        })();
                        return false;

    default: console.error ("Illegal action request in serviceworker: " + message.action);
  }  // end switch
});





// TODO: while a transaciton is going on it might be wise to LOCK the UI including the bookmarks for further manual transactions which might interfere
//      or destroy status !





// TODO: ERROR and EXCEPTION HANDLING in the aws part still is massively dubious

// TODO: must provide error handling for user in main window !!
// query: If undefined then use bookmarks from bookmark bar
//        If query object for chrome tab query then do a tab query
async function uploadBookmarksToS3 (keyName, query) {
  await getAWSCredentials ();
  try {
    let uploadText = await BM.getBookmarksAsString (query);
    console.log ("uploadBookmarksToS3 found text of length " + uploadText.length);
    await uploadStringToS3 (uploadText, keyName);
  } catch (error) { console.error("Error uploading bookmarks to ", keyName); console.error (error); return Promise.reject ("Error uploading");}
  return Promise.resolve();
}


async function downloadBookmarksFromS3 (file) {
  await getAWSCredentials ();
  console.log ("Will download file ", file);
  let downloadText = await downloadStringFromS3 ( file );   // console.log ("downloaded text from S3 ", downloadText);
  await BM.putStringToBookmarks ( downloadText);

}

// CAVE: this code does not immediately reflect changes, since ListObjectsV2Command only adhere to eventual consistency
async function listBookmarksFromS3_Eventual() {  // TODO: must allow parameter bucketname
  await getAWSCredentials();
  try {
    let files = [];
    let continuationToken;
    do {
      const data = await s3Client.send(new ListObjectsV2Command ( { Bucket: AWS_BUCKETNAME, ContinuationToken: continuationToken } ) );
      if (data.Contents) {files = files.concat(data.Contents.map(item => item.Key ));}  // remove last character, which should be delimiter !
      continuationToken = data.NextContinuationToken;
    } while (continuationToken);

    console.log("listBookmarksFromS3: Files in bucket:", files);
    return Promise.resolve (files);
  } catch (err) {console.error("Error listing S3 files:", err); }
}


// this variant adheres to a strict consistency
async function listBookmarksFromS3_Strict ( bucketName ) {  
  await getAWSCredentials();
  bucketName = bucketName || AWS_BUCKETNAME;
  try {
    let files = [];
    let keyMarker;
    let versionIdMarker;
    
    do {
      const data = await s3Client.send(new ListObjectVersionsCommand ( {Bucket: bucketName, KeyMarker: keyMarker, VersionIdMarker: versionIdMarker} ) );

      console.log ("LIST returned", data);
      if (data.Versions) {
        files = files.concat(data.Versions.map(item => item.Key )); // remove last character, which should be delimiter !
      }
      keyMarker = data.NextKeyMarker;
      versionIdMarker = data.NextVersionIdMarker;
    } while (keyMarker);

    console.log("listBookmarksFromS3_Strict: Files in bucket:", files);
    return Promise.resolve(files);
  } catch (err) {
    console.error("Error listing S3 files:", err);
  }
}









chrome.action.onClicked.addListener(async (tab) => {
  // console.log ("action clicked");
  try {
  } catch (error) {
    console.error('Error downloading or installing bookmarks:', error);
  }
});










