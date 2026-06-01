# TopSet

A local-first workout tracker designed to run as an iPhone Home Screen web app.

## Publish with GitHub Pages

1. Create a public GitHub repository named `topset`.
2. Upload or push these files to the repository.
3. In GitHub, open Settings, then Pages.
4. Set Source to Deploy from a branch.
5. Choose the `main` branch and `/root`, then save.
6. Open the published `github.io` URL in Safari on iPhone.
7. Use Share, then Add to Home Screen.

## Best free iPhone route

The free long-term route is to host this folder as a static website on a free HTTPS host, then add it to your iPhone Home Screen from Safari.

Good free hosting options:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

Once hosted:

1. Open the app URL in Safari on your iPhone.
2. Tap Share.
3. Tap Add to Home Screen.
4. Turn on Open as Web App.
5. Tap Add.

The app saves workout data on the phone using browser storage. Use Export in the app to keep backup files, especially before clearing Safari data or changing phones.

## Local preview

From this folder:

```powershell
node preview-server.mjs
```

Then open:

```text
http://127.0.0.1:4173
```

For iPhone use, publish it to HTTPS first. Local desktop preview is only for checking the app while building.
