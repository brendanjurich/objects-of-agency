// Moved: the /contact checks are now the `contact` manifest of tools/contract.mjs, which
// covers every scripted page. This name still works, so older notes stay runnable.
//   node tools/brief-contract.mjs [url]   =   node tools/contract.mjs contact [url]

import { main } from './contract.mjs';

process.argv.splice(2, 0, 'contact');
await main();
