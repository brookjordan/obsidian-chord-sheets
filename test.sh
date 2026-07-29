cd "/Users/brook.jordan/git/brookjordan/obsidian-chord-sheets"
npm run build
VAULT="/Users/brook.jordan/Documents/Obsidian Vault"
mkdir -p "$VAULT/.obsidian/plugins/chord-sheets-generate"
cp main.js styles.css manifest.json \
  "$VAULT/.obsidian/plugins/chord-sheets-generate/"