Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `healthhub://google-calendar-callback?error=${error}` },
    });
  }

  if (code) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': `healthhub://google-calendar-callback?code=${code}` },
    });
  }

  return new Response('Invalid request', { status: 400 });
});
