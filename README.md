# Pain Locator

Pain Locator is a private program on your computer. You turn a 3D human body, tap the spot that hurts, describe that pain in plain words a doctor expects, and save a one-page PDF. It does not diagnose, and it does not suggest treatment.

**Documentation tool only. Not a medical device. Does not diagnose.**

## How to open it

On a Mac, double-click **Open Pain Locator.command** in this folder. The first time, macOS may say it cannot be opened. Right-click the file, choose Open, then choose Open again.

On Linux, double-click **open-pain-locator.sh**. After the first open you can also double-click **Pain Locator** on the Desktop. Linux may ask you to trust the icon the first time. Choose “Trust and Launch” or “Allow Launching.”

The first open installs the helper libraries and can take a few minutes. That first step is the only time the setup uses the internet. After that, the app does not contact the internet.

If a browser window does not appear, open this address yourself: http://127.0.0.1:4721/

That address is a private page on your own computer. It is not a website on the internet. On an iPhone, 127.0.0.1 means the phone itself, so that address cannot open the page.

## The link you can share

The lasting address is:

https://srg13640.github.io/pain-locator/

That page stays up when the Mac is off. Anyone with the link can open it. Your wife can open it in Safari, tap the Share button, then tap **Add to Home Screen**.

The first screen asks which body the picture should use. Choose a woman's body or a man's body. That choice stays on the phone, and the button in the header can change it later. A woman's picture uses a female outer body. A man's picture uses the original atlas body. Notes stay with the body they were marked on.

On that page, the body pictures come from the website. The notes a person types stay in the browser on that phone or computer. They are not saved on GitHub, and they are not saved in your PainLocator folder. Clearing the site data for that page erases the notes on that device. The PDF downloads to that device.

The Mac double-click is separate. It still keeps notes in the PainLocator folder on the computer. The shared page and the Mac keep separate notes.

## Using it on an iPhone

This page can be added to an iPhone home screen. An App Store install has to be built with Apple’s tools on a Mac, and that install cannot be made from here.

To put the icon on the home screen: in Safari, tap the Share button, then tap **Add to Home Screen**.

To close the private page later, double-click **close-pain-locator.sh**. Closing the browser tab leaves the helper running until you do that. Your notes stay either way.

## How to use it

1. Choose a woman's body or a man's body. Then read the warning list. If any of those things are happening now, the screen tells you to call 911. If none of them are happening, continue.
2. Drag on the body to turn it. Scroll or pinch to zoom in. The corner always says whether you are looking at the front, the back, or a side, and which side of the picture is the patient’s left.
3. Tap the spot that hurts. The name is the name of the exact 3D part you touched. You also see a plain-English sentence, and the parts directly underneath, from the outside inward.
4. Fill in how it feels, how strong it is from 0 to 10, whether it spreads (draw an arrow), what brings it on, when it started, how long it lasts, and any notes.
5. Save the pin. Open History to see older notes for the same spot and whether the number went up or down.
6. Click **Export PDF**. The file downloads. On the Mac, a copy is also written into your notes folder. On the shared page, the download is the copy you keep. It shows front, back, and side pictures with the pins, then each pin in the order a clinician reads: location, quality, severity, radiation, timing, and what makes it worse or easier.

The line at the bottom of every screen is permanent: “Documentation tool only. Not a medical device. Does not diagnose.”

Left always means the patient’s left, the same way a doctor uses the word. The L and R letters on the model are labels, not body parts.

Times are saved in US Central Time and marked **CT**.

## Where your notes are

Everything you type is stored in one folder:

`/home/ubuntu/PainLocator`

On your own computer that is the **PainLocator** folder inside your home folder. The About screen shows the full path.

- `entries.json` is the list of pain notes.
- `exports/` holds PDF copies.
- `README.txt` in that folder says the same thing in short.

## How to back up

Copy the whole **PainLocator** folder to a USB drive or another disk. That copy is the backup.

## How to uninstall

1. Double-click **close-pain-locator.sh**.
2. Delete this project folder.
3. Delete the **PainLocator** folder in your home folder if you also want the notes gone.
4. Delete the **Pain Locator** icon on the Desktop if it is there.

## The body model

A man's body is the Z-Anatomy atlas. Z-Anatomy was built from BodyParts3D, a set of 3D parts made from real CT scans, published by the Database Center for Life Science in Japan. I did not build the body out of spheres, boxes, or tubes.

A woman's outer body is the Visible Human female skin from the Human Reference Atlas (Creative Commons Attribution 4.0). It is lined up with the same atlas at the breastbone. The bones, muscles, and organs inside are still that atlas, not a separate female set of organs. The credit is in `public/anatomy/NOTICE.txt`.

Each tappable part keeps the name it has in that atlas. When that name matches the BodyParts3D name table, the screen also shows the Foundational Model of Anatomy number (FMA). Some surface regions and a few muscles are in Z-Anatomy but are not in that name table, so those parts show the atlas name and the plain-English sentence without an FMA number.

The model was already a reduced version of the original scans. One hundred twenty-five of the heavier parts were simplified a second time so the body can turn on an ordinary laptop. Simplifying here means removing extra triangles while keeping the same outline and the same name. The triangle count went from 1,241,090 to 314,234. The About screen states the same counts.

A few pieces were left out on purpose, and the About screen lists them. The short version: the thin wrapping around the lungs was left out so a tap can reach the lung itself, the tiny air tubes inside the lungs were left out for the same reason, and hair and nails were left out of the skin.

Layers you can turn on, off, or make see-through:

1. Skin, as named regions of the outside of the body.
2. Skeleton, including the rib cartilages (shown in a cooler color than the bone).
3. Muscles of the chest, shoulders, back, and belly.
4. Heart, lungs, esophagus, stomach, liver, gallbladder, pancreas, and the large vessels.

## Why it is built this way

Each sentence is one decision.

- This computer is Ubuntu Linux, and Node.js and Python were already installed, so the app uses those instead of asking you to set up a new kind of tool.
- The window is a private web page because that is a reliable way to show a 3D model and still open it with one double-click.
- Node.js is the small helper that serves that page only to this computer, on address 127.0.0.1 and port 4721.
- Three.js is the drawing library that places the 3D body on the page and notices which part a tap hits.
- Z-Anatomy is the anatomy source because the raw BodyParts3D files for the lungs and liver are mostly internal tubes, not the organ surfaces a person would recognize, and Z-Anatomy is derived from those same scans and does include the surfaces.
- The models are stored in the app folder, not downloaded when you tap, so using the app does not need the internet.
- Your notes are ordinary files in the PainLocator folder so you can see them, copy them, and delete them.
- On a phone, and on the shared page, where that folder is not available, the same notes stay in the browser’s saved data on that device.
- The shared page is a normal website address, so the pictures of the body are requested from that same address, including when the address has a folder name in it.
- The PDF is built on this computer with a library called jsPDF, so the summary is not uploaded anywhere.
- Times use the computer’s built-in timezone data for America/Chicago and are labeled CT.
- A content rule in the page blocks it from loading anything except its own files, which is one of the checks that it stays offline.

## Credit for the anatomy

Z-Anatomy, by Gauthier Kervyn, packaged for the desktop viewer by Lluís Vinent Juanico, Creative Commons Attribution-ShareAlike 4.0.

Derived from BodyParts3D, © The Database Center for Life Science. The release 4.0 mesh files carry a Creative Commons Attribution-ShareAlike 2.1 Japan notice. The current BodyParts3D database readme states Creative Commons Attribution 4.0 International.

Please keep that credit if you share the models. The same words are in the About screen and in `public/anatomy/NOTICE.txt`.

## How the offline check was done

After the app is built, this command checks two things: the helper is listening only on this computer, and the built page files contain no web addresses.

```bash
bash scripts/prove-offline.sh
```

The automated tests also refuse to pass if the program code contains a web address other than this computer (127.0.0.1).

## Tests

From this folder, in a terminal:

```bash
npm test
```

A terminal is the text window where you type commands. `npm test` runs the checks for landmark names, Central Time, the PDF, and the 911 safety gate.
