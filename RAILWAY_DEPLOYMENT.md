# Railway Deployment Checklist - AI Protocol Extraction Feature

## Pre-Deployment Testing ✅

- [x] AI extraction workflow tested end-to-end locally
- [x] Document upload and storage working
- [x] Reagent extraction from protocol documents (15/15 reagents extracted successfully)
- [x] Protocol creation with linked documents
- [x] Document preview functionality (text/PDF)
- [x] Document download from detail page
- [x] Document download from library page
- [x] Variable shadowing bug fixed in DocumentLibrary.js
- [x] Code audit for similar bugs completed

## Railway Configuration Steps

### 1. Environment Variables

Add the following to your Railway project environment variables:

```bash
# Anthropic API Key (use your key for testing, then switch to boss's key)
ANTHROPIC_API_KEY=sk-ant-...

# Existing variables (verify they're still set)
DATABASE_URL=<auto-provided by Railway>
JWT_SECRET=<your existing secret>
NODE_ENV=production
PORT=5000
```

**API Key Switching**: Easy - just update the `ANTHROPIC_API_KEY` environment variable in Railway dashboard. No code changes needed.

### 2. Create Railway Volume for File Storage

**Why**: Railway has ephemeral filesystem - files are lost on restart. Volume provides persistent storage.

**Steps**:
1. Go to Railway project dashboard
2. Click "Volumes" tab
3. Click "New Volume"
4. Configure:
   - **Name**: `protocol-documents`
   - **Mount Path**: `/data`
   - **Size**: 1GB (start small, can expand later)
5. Attach volume to your service
6. Redeploy service

**Cost**: ~$0.25/GB/month = ~$0.25/month for 1GB (likely covered by Pro plan $20/month credits)

**Code already prepared**:
- `routes/protocols.js` already checks for Railway environment and uses `/data/uploads/protocol-documents`
- `server.js` logs the upload path on startup

### 3. Deployment Process

#### Option A: Preview Environment (Recommended for Testing)

1. **Create feature branch**:
   ```bash
   git checkout -b ai-extraction-deployment
   ```

2. **Commit all changes**:
   ```bash
   git add .
   git commit -m "feat: Add AI-powered protocol extraction with document management

   - Add Anthropic Claude API integration for reagent extraction
   - Add document upload, preview, and download functionality
   - Fix document variable shadowing bug in DocumentLibrary.js
   - Add Railway Volumes support for persistent file storage
   - Update protocol routes to link documents properly"
   ```

3. **Push to GitHub**:
   ```bash
   git push origin ai-extraction-deployment
   ```

4. **Create Pull Request** on GitHub

5. **Railway Preview Deployment**:
   - Railway will automatically create a preview environment
   - Preview gets its own URL and database
   - Configure ANTHROPIC_API_KEY in preview environment
   - Create Volume in preview environment

6. **Test in Preview**:
   - Upload protocol document via AI extraction
   - Verify reagent extraction works
   - Test document preview/download
   - Verify files persist after redeployment

7. **Merge to main**:
   - Once preview testing passes, merge PR
   - Railway auto-deploys to production

#### Option B: Direct to Production (Less Safe)

1. **Commit and push directly to main**:
   ```bash
   git add .
   git commit -m "feat: Add AI-powered protocol extraction"
   git push origin main
   ```

2. **Railway auto-deploys immediately**

**⚠️ Recommendation**: Use Option A (preview environment) for this feature since it involves:
- External API integration (costs money on failure)
- File storage changes (Volume setup)
- Database schema already deployed (no new migrations)

## Post-Deployment Verification

### 1. Check Deployment Logs

In Railway dashboard, verify:
- [ ] "LLM extraction service initialized successfully"
- [ ] "File upload path configured: /data/uploads/protocol-documents"
- [ ] No error messages during startup

### 2. Verify Volume Mount

Check server logs for:
```
File upload path configured { path: '/data/uploads/protocol-documents' }
```

### 3. Test AI Extraction (Production)

1. Navigate to "New Protocol" page
2. Click "AI Extraction" tab
3. Upload a protocol document (PDF, DOCX, or TXT)
4. Verify:
   - [ ] Document uploads successfully
   - [ ] Reagents are extracted
   - [ ] Quality metrics shown (reagentsFound, withNumericQuantities, withStandardUnits)
   - [ ] Can review/edit extracted reagents
5. Add protocol name and create protocol
6. Navigate to protocol detail page
7. Verify:
   - [ ] Document appears in "Protocol Documents" section
   - [ ] Preview button works (shows document content)
   - [ ] Download button works
8. Navigate to "Document Library" page
9. Verify:
   - [ ] Document appears in library
   - [ ] Download works from library

### 4. Test File Persistence

1. Upload a document via AI extraction
2. Note the document ID
3. Trigger a Railway redeployment (or wait for next deploy)
4. Verify document still accessible after redeploy

## Rollback Plan

If issues occur in production:

1. **Immediate**: Railway dashboard → "Deployments" → Click previous deployment → "Redeploy"
2. **Code revert**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Cost Monitoring

### Anthropic API Costs
- **Model**: claude-3-5-sonnet-20241022
- **Estimated cost**: ~$0.003-0.015 per protocol extraction (varies by document length)
- **Boss's Pro plan**: $20/month credits should cover moderate usage
- **Monitor**: Check Anthropic console for usage

### Railway Volume Costs
- **1GB Volume**: ~$0.25/month
- **Boss's Pro plan**: $20/month credits should cover
- **Can expand**: Resize volume if needed (dashboard → Volumes → Edit)

## Support & Troubleshooting

### Common Issues

**Issue**: "LLM extraction service not initialized"
- **Fix**: Verify ANTHROPIC_API_KEY environment variable is set in Railway

**Issue**: "Failed to save file"
- **Fix**: Verify Volume is mounted at `/data` and attached to service

**Issue**: Documents disappear after redeploy
- **Fix**: Volume not properly configured - check mount path is `/data`

**Issue**: API quota exceeded
- **Fix**: Check Anthropic console, may need to add credits or wait for monthly reset

### Files Changed in This Deployment

- `routes/protocols.js` - Added AI extraction endpoint, document linking, volume path support
- `services/aiReagentExtraction.js` - Core AI extraction logic with honest quality metrics
- `client/src/components/protocols/ProtocolForm.js` - Added AI extraction UI tab
- `client/src/components/protocols/ProtocolReagentCSVUpload.js` - Renamed for AI extraction use
- `client/src/components/protocols/ProtocolDetail.js` - Added document preview/download
- `client/src/components/protocols/DocumentLibrary.js` - Fixed variable shadowing bug
- `server.js` - Added file path logging
- `package.json` - Added dependencies: @anthropic-ai/sdk, pdf-parse, mammoth

## Success Criteria

Deployment is successful when:
- [x] All pre-deployment tests pass locally
- [ ] Railway deployment completes without errors
- [ ] Volume is mounted and accessible
- [ ] AI extraction works in production
- [ ] Documents persist across redeployments
- [ ] No unexpected API errors or costs

## Next Steps After Deployment

1. Monitor Anthropic API usage for first week
2. Switch to boss's API key (just update environment variable)
3. Consider adding usage analytics to track extraction success rate
4. Consider adding rate limiting if needed
5. Document workflow for lab users

---

**Created**: 2025-10-02
**Status**: Ready for deployment
**Estimated Deployment Time**: 30-45 minutes (including Volume setup and testing)
