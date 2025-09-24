# Amplify Deployment Fix Plan

## Issues Identified

1. **Current Status**: The site is NOT completely blank - it shows the authentication screen but has 404 errors for static assets
2. **Configuration Issues**: 
   - Complex standalone + static preparation approach causing deployment complications
   - Missing static assets due to incorrect build configuration
   - Environment variables not properly handled during build

## Root Cause Analysis

The current setup uses:
- `output: 'standalone'` in Next.js config
- Custom `prepare-static-next.mjs` script to copy files
- Complex Amplify build configuration trying to handle both standalone and static files

This approach is causing:
- Static assets not being served correctly
- 404 errors for `/_next/static/` resources
- Authentication working but app content failing to load

## Recommended Solution: Switch to Static Export

Based on the app architecture analysis:
- App uses client-side data fetching (SWR)
- Authentication is handled client-side with AWS Amplify
- All API calls are made from browser to separate backend
- All pages can be pre-rendered as static HTML

## Implementation Plan

### 1. Update Next.js Configuration (`frontend/next.config.js`)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

**Changes:**
- Remove `output: 'standalone'`
- Add `output: 'export'` for static export
- Add `trailingSlash: true` for better Amplify compatibility
- Add `images: { unoptimized: true }` since static export doesn't support Next.js Image optimization

### 2. Update Package.json Build Script (`frontend/package.json`)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**Changes:**
- Remove the custom `&& node ../scripts/prepare-static-next.mjs` from build script
- Simplify to just `next build` since static export handles everything

### 3. Update Amplify Configuration (`amplify.yml`)

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
            - ../scripts/generate-frontend-env.sh ./.env.production
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: out
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

**Changes:**
- Change `baseDirectory` from `.` to `out` (Next.js static export output directory)
- Simplify `files` to `'**/*'` to include all exported files
- Remove specific file patterns that were causing issues

### 4. Remove Custom Static Preparation Script

The `scripts/prepare-static-next.mjs` file is no longer needed and should be removed since Next.js static export handles everything automatically.

### 5. Environment Variables Verification

Ensure the following environment variables are properly set in Amplify:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID`
- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_BYPASS_AUTH`

### 6. Test Plan

After implementing changes:
1. Test local build: `npm run build` should create `out/` directory
2. Test API endpoints are accessible
3. Test authentication flow works
4. Test all application pages load correctly
5. Verify no 404 errors in browser console

## Benefits of This Approach

1. **Simplicity**: Standard Next.js static export, no custom scripts
2. **Reliability**: Well-tested approach for Amplify hosting
3. **Performance**: All pages pre-rendered as static HTML
4. **Compatibility**: Perfect match for client-side data fetching architecture
5. **Maintainability**: Standard Next.js patterns, easier to debug

## Migration Steps

1. Update Next.js config
2. Update package.json build script
3. Update Amplify configuration
4. Remove custom preparation script
5. Test locally
6. Deploy to Amplify
7. Verify all functionality works

## Rollback Plan

If issues occur, can quickly revert by:
1. Restoring original `next.config.js`
2. Restoring original `package.json`
3. Restoring original `amplify.yml`
4. Restoring custom preparation script

## Expected Outcome

- No more 404 errors for static assets
- Faster page loads (pre-rendered HTML)
- Simpler deployment process
- Better reliability and maintainability