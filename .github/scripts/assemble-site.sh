#!/bin/bash
set -e

mkdir -p _site

# Copy vanilla app (exclude build artifacts and unrelated dirs)
rsync -a \
  --exclude=node_modules --exclude=.git --exclude=svelte-app \
  --exclude=tests --exclude=coverage --exclude=docs --exclude=_site \
  --exclude='.github' --exclude='.superpowers' \
  . _site/

# Copy Svelte build into /svelte/ subdirectory
mkdir -p _site/svelte
cp -r svelte-app/build/. _site/svelte/

# --- GitHub Pages SPA routing ---
# GitHub Pages serves the ROOT 404.html for any unknown path.
# This 404.html detects paths under /svelte/ and redirects them to
# the Svelte SPA shell with the intended route encoded as ?p=<path>.
cat > _site/404.html << 'EOF'
<!doctype html><html><head><meta charset="utf-8">
<script>
var l=window.location,p=l.pathname;
if(p.indexOf('/Park_Management/svelte')===0){
  var r=p.replace('/Park_Management/svelte','')||'/';
  l.replace(l.origin+'/Park_Management/svelte/?p='+encodeURIComponent(r)+(l.search?'&q='+encodeURIComponent(l.search.slice(1)):'')+l.hash);
}else{
  document.write('<h1>404</h1><p><a href="/Park_Management/">Back to app</a></p>');
}
</script>
</head></html>
EOF

# Inject a path-restore snippet into the Svelte index.html so SvelteKit
# starts at the correct route when arriving via the 404.html redirect.
python3 - << 'PYEOF'
with open('_site/svelte/index.html') as f:
    html = f.read()
restore = (
    '<script>'
    '(function(){'
    'var sp=new URLSearchParams(window.location.search);'
    'var p=sp.get("p");'
    'if(p){'
    'var q=sp.get("q");'
    'window.history.replaceState(null,null,'
    '"/Park_Management/svelte"+p+(q?"?"+q:"")+window.location.hash);'
    '}})()'
    '</script>'
)
html = html.replace('<head>', '<head>' + restore, 1)
with open('_site/svelte/index.html', 'w') as f:
    f.write(html)
print('Injected path-restore into Svelte index.html')
PYEOF
