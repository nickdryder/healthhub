const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // If there's an error from Fitbit
  if (error) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connection Failed</title>
</head>
<body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; background: #f5f5f5;">
  <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #e53935;">Connection Failed</h1>
    <p style="color: #666;">${errorDescription || error}</p>
    <p style="color: #999;">Please close this window and try again.</p>
  </div>
</body>
</html>`;
    return new Response(html, { headers: HTML_HEADERS });
  }

  // If we have a code, redirect directly to the app
  if (code) {
    const appUrl = `healthhub://fitbit-callback?code=${code}`;
    
    // Use HTTP 302 redirect to the app URL scheme
    return new Response(null, {
      status: 302,
      headers: {
        'Location': appUrl,
      },
    });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invalid Request</title>
</head>
<body style="font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center; background: #f5f5f5;">
  <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #e53935;">Invalid Request</h1>
    <p style="color: #666;">No authorization code received.</p>
  </div>
</body>
</html>`;
  return new Response(html, { status: 400, headers: HTML_HEADERS });
});