# Publishing @orchestro/init to npm

This guide explains how to publish the `@orchestro/init` package to npm registry.

## Prerequisites

1. **npm Account**: [Create one here](https://www.npmjs.com/signup) if you don't have one
2. **npm CLI**: Already installed with Node.js
3. **Organization (Optional)**: Create `@orchestro` organization on npm

## Setup Steps

### 1. Login to npm

```bash
npm login
```

Enter your credentials when prompted.

### 2. Create npm Organization (First Time Only)

If publishing under `@orchestro` scope, create the organization:

1. Go to https://www.npmjs.com/org/create
2. Create organization named `orchestro`
3. Choose free plan (for open source)

Alternatively, change the package name in `package.json` to unscoped:

```json
{
  "name": "orchestro-init",  // instead of @orchestro/init
  ...
}
```

### 3. Update Package Information

Before publishing, update `package.json`:

```json
{
  "name": "@orchestro/init",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/orchestro.git",  // UPDATE THIS
    "directory": "packages/init"
  },
  "homepage": "https://github.com/YOUR_USERNAME/orchestro#readme"  // UPDATE THIS
}
```

Also update the git clone URL in `index.js`:

```javascript
// Line ~107
execSync(
  `git clone --depth 1 https://github.com/YOUR_USERNAME/orchestro.git "${installDir}"`,
  { stdio: 'ignore' }
);
```

### 4. Test Locally Before Publishing

```bash
cd packages/init

# Test the installer
node index.js

# Or test with npm link
npm link
npx @orchestro/init  # This should work
npm unlink -g @orchestro/init
```

### 5. Publish to npm

```bash
cd packages/init

# For scoped package (first time)
npm publish --access public

# For subsequent updates
npm publish
```

### 6. Verify Publication

```bash
# Search for your package
npm search @orchestro/init

# View package page
npm view @orchestro/init

# Test installation
npx @orchestro/init
```

## Version Updates

When making changes:

1. **Update version in package.json**:
   ```bash
   # Patch release (bug fixes): 1.0.0 → 1.0.1
   npm version patch

   # Minor release (new features): 1.0.0 → 1.1.0
   npm version minor

   # Major release (breaking changes): 1.0.0 → 2.0.0
   npm version major
   ```

2. **Publish the update**:
   ```bash
   npm publish
   ```

## Automation with GitHub Actions (Optional)

Create `.github/workflows/publish-init.yml`:

```yaml
name: Publish @orchestro/init

on:
  push:
    tags:
      - 'init-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: |
          cd packages/init
          npm install

      - name: Publish to npm
        run: |
          cd packages/init
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Then create releases with tags:

```bash
git tag init-v1.0.0
git push origin init-v1.0.0
```

## Package Maintenance

### Unpublish (Use with Caution)

⚠️ **Warning**: Can only unpublish within 72 hours of publishing!

```bash
npm unpublish @orchestro/init@1.0.0  # Specific version
npm unpublish @orchestro/init --force  # Entire package (dangerous!)
```

### Deprecate a Version

```bash
npm deprecate @orchestro/init@1.0.0 "This version has critical bugs, please upgrade"
```

### Transfer Ownership

```bash
npm owner add USERNAME @orchestro/init
npm owner rm USERNAME @orchestro/init
```

## Troubleshooting

### "You do not have permission to publish"

- Make sure you're logged in: `npm whoami`
- Check organization membership (for scoped packages)
- Verify package name isn't taken: `npm view @orchestro/init`

### "Package name too similar to existing package"

- npm prevents similar names to avoid confusion
- Choose a more unique name or use a scope

### "Tag already exists"

- You tried to publish the same version twice
- Bump the version number in package.json first

## Best Practices

1. **Always test locally** before publishing
2. **Use semantic versioning** (MAJOR.MINOR.PATCH)
3. **Keep README up to date** - it shows on npm page
4. **Add keywords** for discoverability
5. **Include LICENSE file** (MIT recommended)
6. **Set up 2FA** on your npm account for security

## Current Status

- ✅ Package created locally
- ✅ Tested and working
- ⏳ Ready to publish
- ⏳ Update GitHub URLs before publishing
- ⏳ Create npm organization (if using @orchestro scope)

## Quick Publish Checklist

- [ ] npm login
- [ ] Update GitHub URLs in package.json and index.js
- [ ] Test locally with `node index.js`
- [ ] Test with `npm link` and `npx @orchestro/init`
- [ ] Bump version if needed
- [ ] `npm publish --access public`
- [ ] Verify with `npm view @orchestro/init`
- [ ] Test installation: `npx @orchestro/init`
- [ ] Update main README with correct npm command
- [ ] Create git tag: `git tag init-v1.0.0`
- [ ] Push tag: `git push origin init-v1.0.0`

## Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm Organizations](https://docs.npmjs.com/orgs/)
- [Package Scopes](https://docs.npmjs.com/cli/v9/using-npm/scope)
