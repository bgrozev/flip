const fs = require('fs');
const path = require('path');

const GA_ID = process.env.GA_ID;
if (!GA_ID) {
  console.log('No GA_ID provided. Skipping analytics injection.');
  process.exit(0);
}

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const gaScript = `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
</script>
`;

html = html.replace('<!-- analytics -->', gaScript.trim());
fs.writeFileSync(indexPath, html);

console.log('Injected Google Analytics tag');

