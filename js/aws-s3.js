

import { S3Client, ListBucketsCommand, ListObjectVersionsCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";




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





// Function promising to convert a readable stream to a string
const streamToString = (stream) => {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let chunks = [];

    // Read the stream data
    function readStream() {
      reader.read().then(({ value, done: isDone }) => {
        if (isDone) {
          done = true;
          resolve(chunks.join(''));
          return;
        }

        // Decode and store the chunk as a string
        chunks.push(decoder.decode(value, { stream: true }));
        if (!done) {readStream();}
      }).catch(reject);
    }

    // Start reading the stream
    readStream();
  });
};




export async function getLatestVersionNumber (fileName, bucketName ) {
  const VERBOSE = false;
  await getAWSCredentials();
  bucketName = bucketName || AWS_BUCKETNAME;
  const listCommand  = new ListObjectVersionsCommand ( { Bucket: bucketName, Prefix: fileName } );
  const listResponse = await s3Client.send ( listCommand );
  if (VERBOSE) {console.log ("listing all versions of " + fileName , listResponse);}
  const latestVersion = listResponse.Versions?.sort((a, b) => b.LastModified - a.LastModified)[0];
  return latestVersion?.VersionId;
}







export async function deleteAllVersionsFromS3 (objectKey, bucketName) {
  await getAWSCredentials ();
  bucketName = bucketName || AWS_BUCKETNAME;
  const deletePromises = [];  // do all activities in parallel, but collect them for barriere synchronization

  // console.log ("ServiceWorker: deleting all versions from object key " + objectKey);
  try {
    let isTruncated = true;
    let versionMarker = undefined;

    while (isTruncated) {  // there is a limit to the number of version deletions - so we must paginate
      const listCommand = new ListObjectVersionsCommand({ Bucket: bucketName, Prefix: objectKey, Delimiter:"!", VersionMarker: versionMarker,});  // list all versions
      const data = await s3Client.send(listCommand);
      // console.log ("While deleting: result of listing is:", data);

      for (const version of data.Versions ?? []) {  // delete each version and delete marker ; if undefined use empty array
        const deleteCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey, VersionId: version.VersionId });
        // console.log(`Deleting version: ${version.VersionId} of ${objectKey}`);
        deletePromises.push ( s3Client.send(deleteCommand) );
      }

      // Also delete any delete markers
      // in case data.DeleteMarkers is undefined, which might be the case, use empty array
      for (const marker of data.DeleteMarkers ?? []) {
        const deleteMarkerCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey,  VersionId: marker.VersionId,});
        // console.log(`Deleting delete marker: ${marker.VersionId}`);
        deletePromises.push ( s3Client.send(deleteMarkerCommand ));
      }

      // Check if there are more versions to process
      isTruncated = data.IsTruncated;
      if (isTruncated) {versionMarker = data.NextKeyMarker;}
    }

    await Promise.all(deletePromises);  // Wait for all deletion promises to complete

    console.log(`Successfully deleted all versions and delete markers for: ${objectKey}`);
  } catch (error) {
    console.error('Error deleting object versions:', error);
  }
}



// this has strict consistency
export async function countVersionsFromS3 ( objectKey, bucketName ) { 
  await getAWSCredentials ();
  bucketName = bucketName || AWS_BUCKETNAME;
  let oldVersionCount = 0;
  let isTruncated = true;
  let keyMarker;
  let versionIdMarker;

  while (isTruncated) {
    const listCommand = new ListObjectVersionsCommand ({Bucket: bucketName, Prefix: objectKey, KeyMarker: keyMarker, VersionIdMarker: versionIdMarker });
    const data = await s3Client.send(listCommand);

    oldVersionCount += data.Versions.length || 0;    

    // Check if there are more results to fetch
    isTruncated = data.IsTruncated;
    keyMarker = data.NextKeyMarker;
    versionIdMarker = data.NextVersionIdMarker;
  }

  return oldVersionCount;
}


// Usage example  listKeysWithVersionCount("my-versioned-bucket").then(versionMap => { for (const [key, count] of versionMap.entries()) {console.log(`Key: ${key}, Versions: ${count}`); }
// this has strict consistency
export async function listKeysWithVersionCount ( bucketName ) {
  await getAWSCredentials ();
  bucketName = bucketName || AWS_BUCKETNAME;  
  const versionCountMap = new Map(); // Key -> Number of versions
  let isTruncated = true;
  let keyMarker;
  let versionIdMarker;

  while (isTruncated) {
    const listCommand = new ListObjectVersionsCommand ( {Bucket: bucketName, KeyMarker: keyMarker, VersionIdMarker: versionIdMarker} );
    const data = await s3Client.send(listCommand);

    // Process versions
    for (const version of data.Versions ?? []) { versionCountMap.set ( version.Key, (versionCountMap.get(version.Key) || 0) + 1); }

    // Process delete markers (they count as versions in S3)
    for (const marker of data.DeleteMarkers ?? []) { versionCountMap.set(marker.Key, (versionCountMap.get(marker.Key) || 0) + 1); }

    // Handle pagination
    isTruncated     = data.IsTruncated;
    keyMarker       = data.NextKeyMarker;
    versionIdMarker = data.NextVersionIdMarker;
  }

  return versionCountMap;
}






// TODO: we might need end of key marker in the key names !!!!!!!

export async function downloadStringFromS3 ( fileName ) {
  await getAWSCredentials();
  let version = await getLatestVersionNumber ( fileName );   // console.log ("downloadStringFromS3: latest version number is: ", version);
  let data;
  try {
    data = await s3Client.send(new GetObjectCommand( { Bucket: AWS_BUCKETNAME, Key: fileName, VersionId: version, requestCacheOptions: { cache: "no-store" } } ) ); // Explicitly disable caching ));  // console.log ("data is", data);
    const { Body } = data;  // console.log ("downloadStringFromS3: body is", Body);
    const fileContents = await streamToString(Body);
    return fileContents;
  } catch (x) { console.error ("error while downloading ", fileName); console.error ( x );  console.error ( data);}
}


export async function uploadStringToS3( txt, filename ) {
  await getAWSCredentials();
  try {
    const data = await s3Client.send( new PutObjectCommand( { Bucket: AWS_BUCKETNAME,  Key: filename, Body: txt, ContentType: 'text/plain' } ) );
    console.log('Successfully uploaded file to S3:', data);
  } catch (err) {
    console.error('Error uploading file to S3:', err);
    return Promise.reject ("Error uploading file to S3" + err);
  }
  return Promise.resolve();
}





