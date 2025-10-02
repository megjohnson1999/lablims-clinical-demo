# AWS S3 Migration Guide for Document Storage

## Overview
This guide outlines the strategy for migrating the LIMS document storage system from local file storage to Amazon S3 for cloud deployment.

## Current Architecture
- **Local Storage**: Files stored in `uploads/protocol-documents/`
- **Database**: File metadata in `protocol_documents` table
- **File Paths**: Local filesystem paths stored in `file_path` column

## AWS S3 Migration Strategy

### 1. Infrastructure Setup
```bash
# AWS S3 Bucket Configuration
- Bucket name: `lims-protocol-documents-{environment}`
- Region: Choose based on your primary location
- Versioning: Enabled (recommended)
- Encryption: AES-256 or KMS
- Lifecycle policies: Archive old documents to cheaper storage classes
```

### 2. Code Changes Required

#### Backend (Node.js)
```javascript
// Install AWS SDK
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

// Update multer configuration
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    key: function (req, file, cb) {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `protocol-documents/${name}_${timestamp}${ext}`);
    }
  })
});
```

#### Environment Variables
```bash
# Add to .env file
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=lims-protocol-documents-prod
```

#### Database Schema Updates
```sql
-- Update file_path column to store S3 keys instead of local paths
-- No schema changes needed - just change the data format:
-- Old: /uploads/protocol-documents/file_123.pdf
-- New: protocol-documents/file_123.pdf (S3 key)
```

### 3. File Download Updates
```javascript
// Replace direct file serving with pre-signed URLs
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

router.get('/documents/:id/download', auth, async (req, res) => {
  // Get file info from database
  const document = await getDocumentById(req.params.id);
  
  // Generate pre-signed URL (valid for 1 hour)
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: document.file_path, // S3 key
  });
  
  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  
  // Redirect to pre-signed URL or return URL to client
  res.redirect(signedUrl);
});
```

### 4. Migration Process

#### Data Migration
1. **Backup current files**: Ensure all local files are backed up
2. **Upload to S3**: Transfer existing files to S3 bucket
3. **Update database**: Update `file_path` values to S3 keys
4. **Test downloads**: Verify all files are accessible via new system

#### Migration Script Example
```javascript
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function migrateFilesToS3() {
  const documents = await db.query('SELECT * FROM protocol_documents');
  
  for (const doc of documents.rows) {
    const localPath = doc.file_path;
    const s3Key = `protocol-documents/${doc.filename}`;
    
    // Upload to S3
    const fileContent = fs.readFileSync(localPath);
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: doc.mime_type,
    }));
    
    // Update database
    await db.query(
      'UPDATE protocol_documents SET file_path = $1 WHERE id = $2',
      [s3Key, doc.id]
    );
  }
}
```

### 5. Benefits of S3 Migration
- **Scalability**: No storage limits
- **Durability**: 99.999999999% (11 9's) durability
- **Cost-effective**: Pay only for what you use
- **Global accessibility**: Fast access from anywhere
- **Backup & versioning**: Built-in backup and versioning
- **Security**: Fine-grained access controls

### 6. Deployment Considerations
- **IAM Roles**: Use IAM roles instead of access keys in production
- **VPC Endpoints**: Consider VPC endpoints for better security
- **CloudFront**: Add CloudFront CDN for faster global access
- **Monitoring**: Use CloudWatch for monitoring and alerts
- **Cost optimization**: Implement lifecycle policies

### 7. Testing Strategy
1. **Unit tests**: Test S3 upload/download functions
2. **Integration tests**: Test full document workflow
3. **Load testing**: Ensure performance meets requirements
4. **Rollback plan**: Have a plan to revert to local storage if needed

## Implementation Priority
1. **Phase 1**: Set up S3 infrastructure and test environment
2. **Phase 2**: Update code for S3 integration
3. **Phase 3**: Migrate existing files
4. **Phase 4**: Deploy to production with monitoring
5. **Phase 5**: Cleanup old local files after verification

## Estimated Timeline
- **Setup & Development**: 1-2 weeks
- **Testing & Migration**: 1 week
- **Production Deployment**: 1-2 days
- **Total**: 3-4 weeks