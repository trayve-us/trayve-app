# Testing the Shopify App

## Quick Start Guide

### Prerequisites
- Main Trayve app running on `localhost:3000`
- Ngrok or similar tunneling service
- Shopify Partner account
- Development store

### Step 1: Start the Development Server

```bash
cd D:/Trayve_Production/trayve-app
npm run dev
```

This will start:
- Remix dev server
- Shopify CLI tunnel (ngrok alternative)

### Step 2: Install in Development Store

1. Shopify CLI will provide an installation URL
2. Click the URL or copy to browser
3. Select your development store
4. Click "Install app"
5. Grant permissions

### Step 3: Test the App

#### Home Page
- ✅ Verify shop name displays correctly
- ✅ Click "Open Virtual Try-On Studio"

#### Studio Page
1. **Upload Step**
   - Click "Choose Image"
   - Select a clothing image (JPG/PNG)
   - Should advance to model selection

2. **Model Selection**
   - See model grid (placeholder for now)
   - Click a model to select
   - Click "Generate Images"

3. **Generation**
   - See loading spinner
   - Status updates (if implemented)

4. **Results**
   - View generated images
   - Download functionality
   - Click "Create Another" to restart

#### Settings Page
- ✅ Verify shop domain displays
- ✅ Check integration status
- ✅ Click "Manage Credits" link

### Step 4: Verify Database

Check Supabase for new records:

```sql
-- Check if store was saved
SELECT * FROM shopify_stores ORDER BY installed_at DESC LIMIT 1;

-- Check usage tracking
SELECT * FROM shopify_app_usage ORDER BY created_at DESC LIMIT 10;

-- Check product mappings (after generation)
SELECT * FROM shopify_product_mappings ORDER BY synced_at DESC LIMIT 10;
```

### Step 5: Test API Proxy

Open browser console and check network tab:
- API calls should proxy to `localhost:3000`
- Check for authentication headers
- Verify response status codes

### Common Issues

#### 1. OAuth Error
**Problem:** "Invalid OAuth request"
**Solution:** 
- Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` in `.env`
- Check `HOST` matches ngrok URL
- Restart dev server after `.env` changes

#### 2. Database Connection Error
**Problem:** "Failed to connect to Supabase"
**Solution:**
- Verify `SUPABASE_URL` and keys in `.env`
- Check internet connection
- Verify Supabase project is active

#### 3. API Proxy Fails
**Problem:** "Failed to fetch from Trayve API"
**Solution:**
- Ensure main Trayve app is running on `localhost:3000`
- Check `TRAYVE_API_URL` in `.env`
- Verify CORS settings in main app

#### 4. Generation Fails
**Problem:** Images don't generate
**Solution:**
- Check credits in main Trayve app
- Verify user authentication
- Check browser console for errors
- Review Supabase logs

### Testing Checklist

- [ ] App installs successfully
- [ ] Home page loads with shop info
- [ ] Studio page accessible
- [ ] File upload works
- [ ] Model selection displays
- [ ] Generate button enabled after selection
- [ ] Loading state shows during generation
- [ ] Results display after completion
- [ ] Download button works
- [ ] Settings page shows correct info
- [ ] Database records created
- [ ] API calls succeed
- [ ] Credits deducted properly

### Development Workflow

1. **Start Main Trayve App**
   ```bash
   cd D:/Trayve_Production/trayve
   npm run dev
   ```

2. **Start Shopify App** (separate terminal)
   ```bash
   cd D:/Trayve_Production/trayve-app
   npm run dev
   ```

3. **Make Changes**
   - Edit files in `app/` directory
   - Remix will hot-reload automatically

4. **Test in Browser**
   - Refresh Shopify admin page
   - Test your changes

5. **Check Logs**
   - Terminal output for server errors
   - Browser console for client errors
   - Supabase dashboard for database issues

### Manual Testing Scenarios

#### Scenario 1: New Merchant Installation
1. Install app in fresh dev store
2. Verify welcome page appears
3. Check database for new `shopify_stores` record
4. Verify `is_active = true`

#### Scenario 2: Generate First Image
1. Navigate to Studio
2. Upload clothing image
3. Select model
4. Start generation
5. Wait for completion
6. Verify image in results
7. Check `shopify_app_usage` table
8. Confirm credits deducted

#### Scenario 3: Product Mapping
1. Generate images for product
2. Select images to sync
3. Map to Shopify product
4. Check `shopify_product_mappings` table
5. Verify product in Shopify admin

#### Scenario 4: App Uninstall
1. Uninstall app from Shopify admin
2. Check `shopify_stores.is_active = false`
3. Verify cleanup completed

### Performance Testing

- **Image Upload:** Should complete < 2 seconds
- **Model Loading:** Should display < 1 second
- **Generation Start:** Should respond immediately
- **Polling Interval:** Check every 3 seconds
- **Results Display:** Should load < 1 second

### Security Testing

- [ ] OAuth tokens stored securely
- [ ] RLS policies prevent unauthorized access
- [ ] API calls require authentication
- [ ] User can only see their own data
- [ ] Sensitive data encrypted

## Next: Production Deployment

Once testing is complete:
1. Update SHOPIFY_API_KEY for production app
2. Set production HOST URL
3. Update TRAYVE_API_URL to production endpoint
4. Deploy to hosting platform
5. Submit app for Shopify review

## Support

For issues:
1. Check logs in terminal
2. Review browser console
3. Check Supabase dashboard
4. Review PROJECT-STATUS.md
5. Consult Shopify CLI docs
