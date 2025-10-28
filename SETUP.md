# Trayve Shopify App - Setup Complete ✅

## 📁 Project Structure

```
D:/Trayve_Production/
├── trayve/                          # Main Trayve App (UNCHANGED)
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── .env.local                   # Original environment
│
└── trayve-app/                      # NEW Shopify App
    ├── app/
    │   ├── lib/
    │   │   ├── supabase.server.ts          # ✅ Supabase client
    │   │   ├── api-client.ts               # ✅ Trayve API wrapper
    │   │   └── shopify-session.server.ts   # ✅ Session management
    │   └── routes/
    │       ├── _index.tsx                  # ⏭️ TODO: Dashboard
    │       └── studio.tsx                  # ⏭️ TODO: Studio route
    │
    ├── .env                         # ✅ Environment variables
    ├── supabase-migration.sql       # ✅ Database schema
    └── package.json                 # ✅ Dependencies installed
```

## ✅ Completed Steps

### 1. **Shopify App Initialized**
- App Name: `trayve-app`
- Client ID: `be8b7882633ea4a26bf4bd4b2790dd45`
- Framework: Remix + TypeScript
- Registered with Shopify Partner (Trayve organization)

### 2. **Supabase Integration**
- ✅ Installed `@supabase/supabase-js`
- ✅ Created `supabase.server.ts` with shared database connection
- ✅ Same database as main Trayve app
- ✅ Both anon and service role clients

### 3. **API Client Created**
- ✅ `api-client.ts` - Proxies requests to main Trayve app
- ✅ Studio API: createProject, getResults, removeBackground
- ✅ User API: getSubscription, getProfile
- ✅ Subscription API: getPlans

### 4. **Database Schema**
- ✅ `shopify_stores` - Store merchant sessions
- ✅ `shopify_product_mappings` - Link products to projects
- ✅ `shopify_app_usage` - Track usage for billing
- ✅ RLS policies for security
- ✅ Indexes for performance

### 5. **Session Management**
- ✅ `shopify-session.server.ts` - Supabase-based session storage
- ✅ Save/get/delete store sessions
- ✅ Product-to-project mapping
- ✅ Usage tracking

### 6. **Environment Configuration**
- ✅ Shared Supabase credentials
- ✅ Trayve API URL for proxying
- ✅ Shopify API keys

## 🔄 Architecture

```
┌──────────────────────────────────────┐
│   Shopify Admin (Merchant Store)    │
│   ┌──────────────────────────────┐   │
│   │   Embedded Trayve App        │   │
│   │   (trayve-app)               │   │
│   └──────────┬───────────────────┘   │
└──────────────┼───────────────────────┘
               │
               ├─────┐
               │     │
       ┌───────▼─┐   └─────────────────┐
       │         │                     │
       │  API    │              ┌──────▼────────┐
       │  Proxy  │              │   Supabase    │
       │         │              │   Database    │
       └────┬────┘              │  (Shared)     │
            │                   └───────────────┘
            │
    ┌───────▼────────────────┐
    │   Main Trayve App      │
    │   (localhost:3000)     │
    │                        │
    │   - /api/projects      │
    │   - /api/remove-bg     │
    │   - Pipeline           │
    │   - Replicate AI       │
    └────────────────────────┘
```

## 🎯 How It Works

### API Call Flow:
1. Shopify app calls `trayveApi.studio.createProject()`
2. Request goes to `localhost:3000/api/projects`
3. Main Trayve app processes (existing logic)
4. Response returned to Shopify app
5. Both apps read/write to same Supabase database

### Data Sharing:
- ✅ Same `projects` table
- ✅ Same `generation_results` table
- ✅ Same `user_banners` table
- ✅ New `shopify_stores` for merchant sessions
- ✅ New `shopify_product_mappings` for tracking

## 📋 Next Steps (TODO)

### 1. Run Database Migration
```bash
# Go to Supabase Dashboard
# Navigate to SQL Editor
# Run the contents of supabase-migration.sql
```

### 2. Create Studio Route
```bash
# Copy studio components from main project
cp -r ../trayve/components/ai-studio ./app/components/
cp -r ../trayve/components/ui ./app/components/

# Create studio route page
# File: app/routes/studio.tsx
```

### 3. Install TailwindCSS & shadcn/ui
```bash
npm install -D tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react
```

### 4. Test Both Apps Running Together
```bash
# Terminal 1: Main Trayve App
cd ../trayve
npm run dev              # Runs on localhost:3000

# Terminal 2: Shopify App
cd ../trayve-app
shopify app dev          # Creates tunnel + embedded app
```

## 🔐 Environment Variables

### trayve-app/.env
```env
# Calls to main Trayve app
TRAYVE_API_URL=http://localhost:3000

# Shared Supabase database
NEXT_PUBLIC_SUPABASE_URL=https://ywfspfprntmvvjhuoxup.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Shopify
SHOPIFY_API_KEY=be8b7882633ea4a26bf4bd4b2790dd45
```

## 🔌 API Usage Examples

### In Your Shopify App Routes:

```typescript
import { trayveApi } from '~/lib/api-client';

// Create a new project
const project = await trayveApi.studio.createProject({
  title: `Product: ${shopifyProduct.title}`,
  shopify_product_id: shopifyProduct.id.toString()
});

// Get results
const results = await trayveApi.studio.getProjectResults(project.id);

// Remove background
await trayveApi.studio.removeBackground(
  imageId,
  imageUrl,
  projectId
);

// Get user subscription
const subscription = await trayveApi.user.getSubscription();
```

## 📊 Database Tables to Add

Run this SQL in Supabase Dashboard:
- See `supabase-migration.sql` file

## ✅ Benefits of This Setup

1. ✅ **No Code Duplication** - Uses existing APIs
2. ✅ **Shared Database** - Both apps access same data
3. ✅ **Separate Concerns** - Shopify app is standalone
4. ✅ **Easy Development** - Run both apps locally
5. ✅ **Scalable** - Can deploy independently
6. ✅ **Secure** - Supabase RLS policies
7. ✅ **Traceable** - Track Shopify-specific usage

## 🚀 Ready for Next Phase

You're now ready to:
1. ✅ Run the database migration
2. ✅ Create the studio UI routes
3. ✅ Copy components from main project
4. ✅ Test the integration
5. ✅ Deploy to Shopify App Store

Would you like to proceed with creating the studio route?
