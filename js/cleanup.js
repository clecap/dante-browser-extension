// currently unused code we might later include to cleanup features


function clearIndexedDB() {
  const indexedDB = window.indexedDB;

  // Get all available databases
  indexedDB.databases().then(databases => {
    databases.forEach(db => {
      const dbName = db.name;
      
      // Open the database and delete it
      const request = indexedDB.deleteDatabase(dbName);

      request.onsuccess = function () {
        console.log(`Deleted IndexedDB database: ${dbName}`);
      };

      request.onerror = function () {
        console.error(`Error deleting IndexedDB database: ${dbName}`);
      };
    });
  }).catch((error) => {
    console.error('Error accessing IndexedDB databases:', error);
  });
}

function clearAppCache() {
  if ('applicationCache' in window) {
    const appCache = window.applicationCache;
    appCache.update(); // Refresh the cache (could also use appCache.abort() to stop current operations)
    appCache.oncached = () => {
      appCache.swapCache(); // Replace the old cache with the new one
      console.log("AppCache cleared and updated");
    };
    appCache.onerror = (e) => {
      console.error("AppCache Error", e);
    };
  } else {
    console.warn("AppCache API is deprecated and may not work in modern browsers.");
  }
}


function clearCache() {
  // Get all the caches
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      caches.delete(cacheName).then(() => {
        console.log(`Cache ${cacheName} cleared.`);
      });
    });
  }).catch((error) => {
    console.error("Error clearing caches", error);
  });
}



function deleteFiles() {
  // Request persistent filesystem
  window.requestFileSystem(window.PERSISTENT, 1024 * 1024, function(fs) {
    // If you have a specific directory or file, you can delete it like so:
    fs.root.getDirectory('your_directory_name', { create: false }, function(dirEntry) {
      // Delete the directory and its contents
      dirEntry.removeRecursively(function() {
        console.log("Directory and its contents removed");
      }, function(err) {
        console.error("Error removing directory", err);
      });
    }, function(err) {
      console.error("Error accessing directory", err);
    });
  }, function(err) {
    console.error("Error requesting filesystem", err);
  });
}


function deleteTemporaryFiles() {
  // Request temporary filesystem
  window.requestFileSystem(window.TEMPORARY, 1024 * 1024, function(fs) {
    // Example: Get a file and delete it
    fs.root.getFile('your_file.txt', { create: false }, function(fileEntry) {
      fileEntry.remove(function() {
        console.log("File removed");
      }, function(err) {
        console.error("Error removing file", err);
      });
    }, function(err) {
      console.error("Error accessing file", err);
    });
  }, function(err) {
    console.error("Error requesting filesystem", err);
  });
}

// Call the function to delete temporary files
// deleteTemporaryFiles();



function deleteChromeStorage () {
  chrome.storage.local.clear(function() {
    console.log("Cleared all data in chrome.storage.local");
  });
}
