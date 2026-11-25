EVENT PHOTOS

Put the church logo and event photos in this folder.

Then edit ../event.json and use a path like:
  /event-content/images/logo.png

For the logo, put that path in "logoUrl". For a photo, put the path in its "src" field and add a description in "alt". Keep the opening and closing quotation marks.

Example photo entry:
  { "src": "/event-content/images/youth-gathering.jpg", "alt": "Young people at church", "label": "Youth gathering" }

Use "src": null when you want the labeled placeholder instead of a photo.
