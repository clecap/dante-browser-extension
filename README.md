This browser extension provides a simple, private and secure bookmark up-and-down-load between chrome browsers.

## Features

If you click on the extension icon, the extension lists all bookmark files
from the server and offers the following functions:

* <code>Down</code>: Downloads all bookmarks as stored in the latest version of the respective bookmarks file
and merges them with the current bookmarks on the browser.
* <code>Up</code>: Uploads all bookmarks from the browser to the server. The old file is overwritten
but a version of the previous contents is kept on the server.
* <code>Del</code>: Deletes this bookmark file on the server and all of its versions. 
* <code>Clear</code> : Clears all bookmarks from the browser.
* <code>New</code>: Generates a new bookmark file on the server with the given name and uploads
all current bookmarks from the browser to the server.

## Server Requirements

The extension stores the bookmark files on an S3 bucket of AWS. The user thus has to set up an S3
instance on AWS and provide the necessary access data in the option sheet of the extension.
We recommend to use a separate IAM user with restricted rights on S3. The data to be entered there are as follows:

* AWS Access Key ID
* AWS Secret Access Key
* AWS Default Region
* AWS Bucket Name

The extension assumes familiarity with this process. If your need help, consult
[README-AWS.md](README-AWS.md)

In the option sheet you also should enter an AES Password. This is the password which is
used for the end-to-end encryption of the bookmark file. The encryption is under control of the client.

The S3 bucket is assumed to be versioning. Earlier uploads are kept and all previous uploaded
configurations can be restored. Downloads alway pick the most recent version.


## Installation from Source

Requirements: A running <code>node</code> and <code>npm</code> as toolchain.

* Clone this repository into a directory.
* Run <code>npm install</code>
* Run <code>npm run build</code>
* Run <code>npm run clean</code>
* Switch chrome browser into development mode.
* <code>Load unpacked extension</code> and pick this directory
* Pin in the extension manager so we can access the functionality.
* Rightclick the extension icon and go to the options page
* Enter the data, preferably from a password manager
* To have the required data ready on other machines we recommend to store the data in password managers.

## Installation from Chrome Store

We have not yet found time to do this. Sorry.

## Security

* All data in the configuration is stored as part of chrome local storage.
* No private data is kept anywhere outside of your browser.

## Workflow

* Change local bookmarks.
* Notice the badge, notification and icon change, which reminds of the necessity to upload the bookmarks.
* **Warning:** Downloading several times leads to duplicated bookmarks. This is by design. No merging is done.
* **Warning:** Forgetting to upload leads to lost updates. Pretty clear. By design.

## Roadmap

The extension is a quick and dirty hack which I produced when xbrowsersync went out of service.
it does exactly what I need it to do and I offer it here without any warranty, guarantees of whatever.

## Issues and Bugs

* Currently we cannot chose the filename on the S3 bucket, so strictly speaking it is not multi-user.
* Issues are welcome on github.
* <b>Reduce some permissions in the manifest</b>




