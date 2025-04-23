document.addEventListener("DOMContentLoaded", function () {
  const keys = ["AES_Password", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION", "AWS_BUCKETNAME"];
  
  // Load existing settings to display them in the options form
  chrome.storage.sync.get(keys, (data) => {
    keys.forEach((key) => {
      if (data[key]) {
        document.getElementById(key).value = data[key];
      }
    });
  });

  // Save settings entered in the options form when the button is clicked
  document.getElementById("save").addEventListener("click", () => {
    const newSettings = {};
    keys.forEach((key) => {
      newSettings[key] = document.getElementById(key).value;
    });

    chrome.storage.sync.set(newSettings, () => {
      console.log("Settings saved.");
    });
    window.close ();
  });
});
