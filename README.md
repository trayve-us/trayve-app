# Trayve Shopify App

A Shopify embedded app for AI-powered product image generation, powered by the main Trayve platform.

## ÌøóÔ∏è Architecture

This app is designed to work **alongside** the main Trayve application:

- **Frontend**: Embedded Remix app running in Shopify Admin
- **Backend**: Proxies API calls to main Trayve app (`localhost:3000`)
- **Database**: Shares Supabase database with main Trayve app
- **AI Processing**: Uses existing Trayve AI pipeline

## Ì≥¶ Setup

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Ì∫Ä Quick Start

### Prerequisites
1. Main Trayve app running on `localhost:3000`
2. Supabase database migration completed
3. Environment variables configured

### Development

```bash
# Install dependencies
npm install

# Run development server (with Shopify tunnel)
shopify app dev

# Build for production
npm run build
```

## Ì¥ë Environment Variables

Create a `.env` file:

```env
TRAYVE_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SHOPIFY_API_KEY=your-shopify-api-key
```

## Ì≥ö Documentation

- [Shopify App Setup](./SETUP.md)
- [Database Schema](./supabase-migration.sql)
- [API Client](./app/lib/api-client.ts)

## Ìª†Ô∏è Tech Stack

- **Framework**: Remix
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Shopify**: App Bridge, Polaris
- **API**: REST (proxied to main Trayve app)

## Ì≥ù License

Proprietary - Trayve Inc.
