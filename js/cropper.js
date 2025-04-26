const urlParams = new URLSearchParams(window.location.search);
const imgUrl = urlParams.get('img');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const WIKI="https://localhost:4443/wiki-dir/";

const image = new Image();
image.crossOrigin = 'anonymous';
image.src = imgUrl;

let isDragging = false;
let startX = 0, startY = 0;
let endX = 0, endY = 0;
let croppedBlob = null;

const uploadBtn = document.getElementById('upload-btn');

image.onload = () => {
  canvas.width = image.width;
  canvas.height = image.height;
 // ctx.scale (0.3, 0.3);  // reduces the quality of the image

  ctx.drawImage(image, 0, 0);
};

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // TODO: is a clear necessary?
  ctx.drawImage(image, 0, 0);

  if (isDragging || (startX !== endX && startY !== endY)) {
    ctx.fillStyle = 'rgba(0.3, 0, 0, 0.1)';
    // ctx.fillRect(30, 30, canvas.width, canvas.height);

    const x      = Math.min (startX, endX);
    const y      = Math.min (startY, endY);
    const width  = Math.abs (endX - startX);
    const height = Math.abs (endY - startY);

   // ctx.clearRect(x, y, width, height);  // this clears the rectangle, i.e. makes it white
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillRect(x, y, width, height);

  }
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  startX = endX = 2*e.clientX - rect.left;
  startY = endY = 2*e.clientY - rect.top;
  isDragging = true;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  endX = 2*e.clientX - rect.left;
  endY = 2*e.clientY - rect.top;
  redraw();
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
  redraw();
  createCroppedImage();
});



function createCroppedImage() {
  const x      = Math.min(startX, endX);
  const y      = Math.min(startY, endY);
  const width  = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  if (width === 0 || height === 0) return;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  croppedCanvas.toBlob((blob) => { croppedBlob = blob; uploadBtn.disabled = false; }, 'image/png');
}




async function checkLogin () {
  console.log ("Checking if I am still logged in");
  const whoAmIRes = await fetch(WIKI + '/api.php?action=query&meta=userinfo&format=json', { credentials: 'include' });
  const whoAmI    = await whoAmIRes.json();
  console.log('User info:', whoAmI.query.userinfo);
}




uploadBtn.addEventListener('click', async () => {
  if (!croppedBlob) { console.log ("no cropped blob, returning");return;}

/*
  console.log ("Checking if I am still logged in");
  const whoAmIRes = await fetch(WIKI + '/api.php?action=query&meta=userinfo&format=json', { credentials: 'include' });
  const whoAmI    = await whoAmIRes.json();
  console.log('User info:', whoAmI.query.userinfo);
*/

  const formData = new FormData();
  formData.append('action',   'upload');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cropped_${timestamp}.png`;

  formData.append('filename', filename);
  formData.append('format',   'json');
  formData.append('file',     croppedBlob);

  const tokenResponse = await fetch( WIKI + '/api.php?action=query&meta=tokens&type=csrf&format=json');
  const tokenJson     = await tokenResponse.json();            console.log ("tokenJson is", tokenJson);
  const tokenValue = tokenJson.query.tokens.csrftoken;

  formData.append('token', tokenValue);

  const res  = await fetch( WIKI + '/api.php', { method: 'POST', body: formData, credentials: 'include' } );
  const data = await res.json();    console.log ("res.json is", data);

  if (data.upload && data.upload.result === 'Success') {
    const fileName = data.upload.filename;
    const wikitext = `[[File:${fileName}]]`;

    const pageToEdit = prompt('Enter the page title to insert the image into:', 'Sandbox');
    if (pageToEdit) {
      const editUrl = WIKI + `/index.php?title=${encodeURIComponent(pageToEdit)}&action=edit&preload=&summary=Insert image&wpTextbox1=${encodeURIComponent(wikitext)}`;
      window.open(editUrl, '_blank');
    } else {alert('Upload successful: ' + fileName + '\nNo page specified for insertion.');
    }
  }

});
