

# Treatment of S3 Keys

## Situation
* S3 keys may contain delimiters such as / or other characters. 
* The delimiters may be used to emulate a hierarchical structure in the key space.
* The list versions command which lists old versions of a versioned bucket only allows to specify a prefix. 
  As a consequence, listings of all versions of key <code>book</code> would also contain versions of <code>bookmark</code>.
* To prevent this, we will use <code>!</code> as terminator of every key.
* We do not employ <code>/</code> as terminator, since we want to allow the user to use this symbol for semantically structuring
  the space of bookmark file names.

## Convention used
In the software the convention is as follows:

* The S3 gets the full key names.
* The UI displays the keys without ! and sends them to the service worker with the !.
* The UI adds and removes the !


# Overall Architecture


## Serviceworker

* background.js  contains main functions of service worker
* bookmarks.js contains conversion from bookmarks to encrypted strings and back
* crypto.js contains AES encryption and decryption, key derivation and helpers





