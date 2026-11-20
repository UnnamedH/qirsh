/* Worker for scouts.frata.cc: everything is a plain static file except the front page, which goes
   to the scouts app. Every other path is answered by the static files as they are. */
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.redirect(url.origin + '/scouts/' + url.search, 302);
    return env.ASSETS.fetch(request);
  },
};
