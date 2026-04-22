const bcrypt = require('bcrypt');

(async () => {
  const hash = await bcrypt.hash('@bpit2025', 10);
  console.log(hash);
})();
