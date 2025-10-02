# LLM-Powered Protocol Extraction - Setup Guide

## Overview

This feature uses Claude AI to automatically extract reagents from protocol documents (PDF, Word, Markdown), eliminating the need for manual CSV creation.

## Features

✅ **Automatic Reagent Extraction**: Upload protocol documents and AI extracts reagents automatically
✅ **Multiple Format Support**: PDF, Word (.docx), Markdown, and plain text
✅ **Smart Parsing**: AI understands protocol structure and extracts per-sample quantities
✅ **Confidence Scoring**: Each extraction includes confidence scores and warnings
✅ **Graceful Fallback**: Falls back to manual CSV upload if AI unavailable
✅ **Cost Efficient**: ~$0.01-0.05 per protocol extraction

## Setup Instructions

### 1. Get Claude API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-api03-...`)

### 2. Local Development Setup

1. Copy `.env.example` to `.env` (if not already done)
2. Add your API key to `.env`:
   ```env
   LLM_EXTRACTION_ENABLED=true
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```
3. Restart the server:
   ```bash
   node server.js
   ```

### 3. Railway Production Setup

1. Go to Railway dashboard
2. Select your project
3. Navigate to **Variables** tab
4. Add the following environment variables:
   - `LLM_EXTRACTION_ENABLED` = `true`
   - `ANTHROPIC_API_KEY` = `sk-ant-api03-your-key-here`
5. Railway will automatically redeploy with the new configuration

**Note**: Environment variables are encrypted and secure in Railway.

## Usage

### For Lab Members

1. Navigate to **Protocols** → **New Protocol**
2. Scroll to **Required Reagents** section
3. Click on the **CSV Upload** tab
4. You'll see **AI Extraction Available** message
5. Upload your protocol document (PDF, Word, etc.)
6. AI will automatically extract reagents in ~15-30 seconds
7. Review extracted reagents and make any necessary edits
8. Save the protocol

### Workflow Comparison

**Before (Manual CSV)**:
1. Copy protocol text
2. Paste into ChatGPT/Claude externally
3. Wait for CSV response
4. Download CSV
5. Upload to LIMS
6. Review and save

**After (Automated)**:
1. Upload protocol document
2. AI extracts reagents automatically
3. Review and save

**Time Saved**: ~3-5 minutes per protocol

## Feature Flag Control

The feature can be disabled at any time without code changes:

**To Disable**:
- Local: Set `LLM_EXTRACTION_ENABLED=false` in `.env`
- Railway: Remove or set `LLM_EXTRACTION_ENABLED=false` in environment variables

**To Enable**:
- Local: Set `LLM_EXTRACTION_ENABLED=true` and add `ANTHROPIC_API_KEY`
- Railway: Add both environment variables in dashboard

## Cost Management

### Expected Costs

- **Per Protocol**: $0.01 - $0.05 (depends on protocol length)
- **Monthly** (10 protocols/month): ~$0.10 - $0.50
- **Monthly** (50 protocols/month): ~$0.50 - $2.50

### Anthropic Pricing (as of 2025)

- Claude 3.5 Sonnet: $3 per million input tokens, $15 per million output tokens
- Typical protocol: 2,000-5,000 input tokens, 500-1,000 output tokens

### Budget Controls

1. **Set up billing alerts** in Anthropic Console
2. **Monitor usage** in Anthropic dashboard
3. **Disable feature** if costs exceed budget (change environment variable)
4. **Fallback available**: Manual CSV upload always works

## Troubleshooting

### "LLM extraction not available" Message

**Cause**: Feature flag is off or API key missing
**Solution**: Check environment variables in Railway dashboard or local `.env`

### "AI extraction failed" Error

**Possible Causes**:
1. Invalid API key → Check key in environment variables
2. API rate limit → Wait a few moments and try again
3. Network issues → Check internet connection
4. Protocol too long → Use manual CSV upload for very long protocols (>50 pages)

**Fallback**: Manual CSV upload is always available

### Low Confidence Warning

**Meaning**: AI is uncertain about extraction quality
**Action**: Carefully review extracted reagents and edit as needed

## Security Notes

- ✅ API keys are stored as environment variables (not in code)
- ✅ Protocol text is sent to Anthropic's API (encrypted in transit)
- ✅ No protocol data is permanently stored by Anthropic
- ✅ Railway environment variables are encrypted at rest
- ✅ Feature can be disabled anytime without code changes

## Rollback Plan

If issues occur in production:

1. **Instant Disable** (< 1 minute):
   - Railway Dashboard → Variables → Set `LLM_EXTRACTION_ENABLED=false`
   - System reverts to manual CSV workflow immediately

2. **Full Rollback** (< 5 minutes):
   - Railway Dashboard → Deployments → Redeploy previous version
   - Complete code rollback to pre-LLM state

## Testing

### Test Locally

1. Set up API key in `.env`
2. Start server: `node server.js`
3. Start client: `cd client && npm start`
4. Create new protocol
5. Upload a sample protocol document (PDF or Word)
6. Verify reagents are extracted correctly

### Sample Test Protocol

Create a simple test file (`test_protocol.txt`):

```
VLP Enrichment Protocol

Reagents:
- SM buffer: 1200 µL
- Lysozyme 10mg/ml: 80 µL
- TurboDNaseI 2U/µL: 20 µL
- 5X RT Buffer: 4 µL
- dNTP mix: 0.8 µL

Procedure:
1. Add SM buffer to sample
2. Add lysozyme and incubate
3. Add DNase and incubate
```

Expected result: 5 reagents extracted with correct quantities and units.

## Support

- **Feature Issues**: Report in GitHub repository
- **API Key Issues**: Contact Anthropic support
- **Cost Questions**: Check Anthropic Console billing dashboard

## Future Enhancements (Potential)

- [ ] Batch protocol processing
- [ ] Protocol step extraction (not just reagents)
- [ ] Custom extraction prompts per lab
- [ ] Alternative LLM providers (OpenAI, etc.)
- [ ] Offline extraction (local LLM)

---

**Last Updated**: 2025-01-XX
**Feature Version**: 1.0
**Required Node Packages**: `@anthropic-ai/sdk@^0.65.0`
