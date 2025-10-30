# Backend API Organization

This document describes the organized backend API structure for the Trayve Shopify App.

## Overview

The Trayve Shopify App is a **fully self-contained application** that uses:
- **Supabase** for database and storage (PostgreSQL + Storage Buckets)
- **Shopify Admin API** for billing and subscription management
- **Service Layer Architecture** for organized backend logic
- **Local API Routes** for frontend-backend communication

**No external Trayve backend dependencies** - All functionality is implemented locally using the service layer that interfaces directly with Supabase.

## Directory Structure

```
app/
├── lib/
│   ├── services/                    # Organized service layer
│   │   ├── index.ts                # Central export point
│   │   ├── models.service.ts       # Model operations
│   │   └── storage.service.ts      # Storage operations
│   ├── supabase.server.ts          # Supabase client configuration
│   ├── auth.server.ts              # Authentication helpers
│   └── credits.server.ts           # Credits management
└── routes/
    └── api.models.tsx              # Models API endpoint
```

## Services Layer

### `lib/services/models.service.ts`

Handles all operations related to base models and poses.

**Functions:**
- `getBaseModels(filters?)` - Fetch base models with optional filters
- `getBaseModelById(id)` - Get a single model by ID
- `getModelPoses(baseModelId)` - Get poses for a specific model
- `getPromotedModels()` - Get promoted models only
- `getModelsCount(filters?)` - Get count of models

**Filters:**
```typescript
{
  gender?: string;
  body_type?: string;
  is_active?: boolean;
  promoted_only?: boolean;
}
```

### `lib/services/storage.service.ts`

Handles all Supabase storage bucket operations.

**Storage Buckets:**
- `models` - Model images and pose images
- `user-images` - User uploaded content
- `brand-assets` - Brand kit assets

**Functions:**
- `getPublicUrl(filePath, bucket)` - Get public URL for a file
- `uploadToModelsBucket(buffer, fileName)` - Upload to models bucket
- `uploadToUserImagesBucket(buffer, fileName, userId)` - Upload user content
- `deleteFromModelsBucket(filePath)` - Delete from models bucket
- `downloadImageAsBuffer(imageUrl)` - Download image from URL
- `generateUniqueFileName(extension, prefix?)` - Generate unique filename
- `isValidImageType(mimeType)` - Validate image MIME type
- `isValidFileSize(size, maxSizeMB?)` - Validate file size

## API Routes

### `GET /api/models`

Fetch base models with optional filters.

**Query Parameters:**
- `type` - 'base-models' | 'poses' (default: 'base-models')
- `id` - Model ID (for fetching specific model)
- `base_model_id` - Required for type='poses'
- `gender` - Filter by gender
- `body_type` - Filter by body type
- `is_active` - Filter by active status (default: true)
- `promoted_only` - Filter by promoted status (default: true)

**Examples:**
```bash
# Get all promoted models
GET /api/models

# Get models by gender
GET /api/models?gender=female

# Get specific model
GET /api/models?id=abc123

# Get poses for a model
GET /api/models?type=poses&base_model_id=abc123
```

**Response:**
```json
{
  "success": true,
  "models": [...],
  "count": 10,
  "filters": {
    "is_active": true,
    "promoted_only": true
  }
}
```

### `POST /api/models`

Fetch models with filters in request body.

**Request Body:**
```json
{
  "filters": {
    "gender": "female",
    "body_type": "slim",
    "is_active": true,
    "promoted_only": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "models": [...],
  "count": 5,
  "filters": {...}
}
```

## Authentication

All API routes require Shopify authentication via `authenticate.admin(request)`.

To make routes public (if needed), comment out the authentication line:
```typescript
// await authenticate.admin(request);
```

## Error Handling

All services and API routes follow consistent error handling:

```typescript
try {
  // Operation
} catch (error: any) {
  console.error("Error description:", error);
  return json(
    {
      success: false,
      error: error.message || "Fallback error message",
    },
    { status: 500 }
  );
}
```

## Usage Example

### Frontend (Remix Loader)

```typescript
import { getBaseModels, getModelPoses } from "~/lib/services/models.service";

export const loader = async () => {
  const models = await getBaseModels({
    gender: "female",
    is_active: true,
    promoted_only: true,
  });

  const poses = await getModelPoses(models[0].id);

  return json({ models, poses });
};
```

### API Call

```typescript
// GET request
const response = await fetch('/api/models?gender=female&promoted_only=true');
const { models } = await response.json();

// POST request
const response = await fetch('/api/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filters: {
      gender: 'female',
      promoted_only: true
    }
  })
});
const { models } = await response.json();
```

## Type Definitions

### BaseModel
```typescript
interface BaseModel {
  id: string;
  name: string;
  description?: string;
  gender: "male" | "female" | "unisex";
  body_type: "slim" | "athletic" | "curvy" | "plus-size";
  ethnicity?: string;
  age_range?: string;
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  is_promoted: boolean;
  created_at: string;
  updated_at: string;
  poses?: ModelPose[];
}
```

### ModelPose
```typescript
interface ModelPose {
  id: string;
  base_model_id: string;
  name: string;
  description?: string;
  pose_type: "front" | "side" | "three-quarter" | "back" | "dynamic" | "seated";
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}
```

## Best Practices

1. **Use Services Layer** - Always use service functions instead of direct Supabase queries
2. **Consistent Error Handling** - Follow the established error handling pattern
3. **Type Safety** - Use TypeScript interfaces for all data structures
4. **Authentication** - Ensure proper authentication for all routes
5. **Logging** - Use console.log with emojis for better visibility (🔍, ✅, ❌)
6. **Public URLs** - Always convert supabase_path to full URLs using `getPublicUrl()`

## Adding New Services

To add a new service:

1. Create `app/lib/services/your-service.service.ts`
2. Export types and functions
3. Add exports to `app/lib/services/index.ts`
4. Create corresponding API route in `app/routes/api.your-route.tsx`
5. Update this README

## Future Improvements

- [ ] Add caching layer for frequently accessed data
- [ ] Implement pagination for large datasets
- [ ] Add rate limiting for API endpoints
- [ ] Create typed API client for frontend
- [ ] Add comprehensive error codes
- [ ] Implement request validation middleware
