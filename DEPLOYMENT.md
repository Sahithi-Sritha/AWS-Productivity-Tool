# TaskPilot Deployment Guide

Complete guide to deploy TaskPilot to Vercel with GitHub integration.

---

## Step 1: Push to GitHub

### 1.1 Initialize Git Repository (if not already done)

```bash
cd "D:\My projects\aws productivity tool challenge"
git init
```

### 1.2 Create .gitignore (already exists, verify it excludes)

Verify `.gitignore` includes:
```
node_modules
.next
.env*.local
```

### 1.3 Create Initial Commit

```bash
git add .
git commit -m "Initial commit: TaskPilot Next.js app with AWS Lambda integration"
```

### 1.4 Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `taskpilot` (or your preferred name)
3. Description: "AI-powered task prioritization using Next.js 14, AWS Lambda, and Amazon Bedrock"
4. Choose **Public** or **Private** (Private recommended if the Lambda URL is sensitive)
5. **Do NOT** initialize with README, .gitignore, or license (you already have these)
6. Click **Create repository**

### 1.5 Push to GitHub

Copy the commands from GitHub's "push an existing repository" section:

```bash
git remote add origin https://github.com/YOUR_USERNAME/taskpilot.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

**Verify:** Visit your repository URL to confirm files are uploaded.

---

## Step 2: Import to Vercel

### 2.1 Sign in to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** or **Log In**
3. Choose **Continue with GitHub** (recommended for easy integration)
4. Authorize Vercel to access your GitHub account

### 2.2 Import Repository

1. From Vercel dashboard, click **Add New** → **Project**
2. You'll see a list of your GitHub repositories
3. Find `taskpilot` (or your repo name)
4. Click **Import**

### 2.3 Configure Project

On the import screen:

**Project Name:** `taskpilot` (or customize)

**Framework Preset:** Next.js (should auto-detect)

**Root Directory:** `./` (leave as default)

**Build and Output Settings:** (leave as default)
- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `npm install`

**Environment Variables:** ⚠️ **IMPORTANT - Configure this now**

Click **Add Environment Variable** and add:
- **Key:** `AWS_LAMBDA_URL`
- **Value:** Your Lambda Function URL (from Lambda deployment, e.g., `https://abc123.lambda-url.us-east-1.on.aws/`)
- **Environments:** Select **Production**, **Preview**, and **Development** (check all three)

Click **Add** to save the environment variable.

### 2.4 Deploy

1. Click **Deploy**
2. Wait 1-2 minutes for the build to complete
3. You'll see "🎉 Congratulations!" when done

**Your app is now live!** Vercel will show you the URL: `https://taskpilot-xxxxx.vercel.app`

---

## Step 3: Set Environment Variables (if skipped in Step 2.3)

If you didn't add the environment variable during import:

### 3.1 Navigate to Project Settings

1. From your project dashboard, click **Settings** (top navigation)
2. Click **Environment Variables** (left sidebar)

### 3.2 Add AWS_LAMBDA_URL

1. Under "Environment Variables", enter:
   - **Key:** `AWS_LAMBDA_URL`
   - **Value:** Your Lambda Function URL
2. Select environments:
   - ✅ **Production**
   - ✅ **Preview**
   - ✅ **Development** (optional, but recommended)
3. Click **Save**

### 3.3 Redeploy to Apply Changes

Environment variables require a redeploy:

**Option A: Trigger via Git Push**
```bash
# Make a small change (e.g., update README)
echo "\n# Live Demo" >> README.md
git add README.md
git commit -m "Trigger redeploy"
git push
```

**Option B: Manual Redeploy from Vercel**
1. Go to **Deployments** tab
2. Click the three dots (**⋯**) on the latest deployment
3. Click **Redeploy**
4. Confirm **Redeploy**

Wait 1-2 minutes for deployment to complete.

---

## Step 4: Verify Deployment & CORS

### 4.1 Open Deployed App

1. Go to your Vercel project dashboard
2. Click **Visit** or open the deployment URL (e.g., `https://taskpilot-xxxxx.vercel.app`)

### 4.2 Test the Prioritization Flow

1. Enter some test tasks in the textarea:
   ```
   Fix critical login bug
   Review pull requests
   Update documentation
   Plan Q2 features
   Refactor authentication module
   ```
2. Click **Prioritize**
3. Wait for results to appear

### 4.3 Check Browser Console for Errors

**Open Developer Tools:**
- **Chrome/Edge:** Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Firefox:** Press `F12` or `Ctrl+Shift+K`
- **Safari:** Enable Developer menu first (Preferences → Advanced → Show Develop menu), then `Cmd+Option+I`

**Go to Console tab** and look for:

✅ **Success - No errors:**
```
(no CORS errors)
```

❌ **CORS Error (if you see this):**
```
Access to fetch at 'https://xxx.lambda-url.us-east-1.on.aws/' from origin 'https://taskpilot-xxx.vercel.app' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**If you see CORS errors, troubleshoot:**

1. **Verify Lambda CORS Configuration:**
   Check your Lambda Function URL CORS settings:
   ```bash
   aws lambda get-function-url-config \
     --function-name TaskPilotPrioritizer \
     --region us-east-1
   ```
   
   Should show:
   ```json
   {
     "AllowOrigins": ["*"],
     "AllowMethods": ["POST", "OPTIONS"],
     "AllowHeaders": ["Content-Type"]
   }
   ```

2. **Update CORS if needed:**
   ```bash
   aws lambda update-function-url-config \
     --function-name TaskPilotPrioritizer \
     --cors '{
       "AllowOrigins": ["*"],
       "AllowMethods": ["POST", "OPTIONS"],
       "AllowHeaders": ["Content-Type"],
       "MaxAge": 86400
     }' \
     --region us-east-1
   ```

3. **Check Lambda Handler CORS Headers:**
   Verify `lambda/index.mjs` includes:
   ```javascript
   const CORS_HEADERS = {
     "Access-Control-Allow-Origin": "*",
     "Access-Control-Allow-Headers": "Content-Type",
     "Access-Control-Allow-Methods": "POST, OPTIONS"
   };
   ```

4. **Test Lambda Directly:**
   ```bash
   curl -X POST https://YOUR_LAMBDA_URL \
     -H "Content-Type: application/json" \
     -d '{"tasks":"Test task 1\nTest task 2"}' \
     -v
   ```
   
   Look for `Access-Control-Allow-Origin: *` in response headers.

### 4.4 Test History Feature (if DynamoDB is configured)

1. Click **View History** link
2. Verify past prioritizations appear (after you've made at least one)
3. Click a history item to reload it

### 4.5 Check Network Tab for Full Request/Response

1. In Developer Tools, go to **Network** tab
2. Click **Prioritize** again
3. Find the request to `/api/prioritize`
4. Click it to see:
   - **Request payload:** Your tasks
   - **Response:** Prioritized results JSON
   - **Status:** Should be `200 OK`

---

## Step 5: Get Your Final Vercel URL

### 5.1 Find Your Production URL

**From Vercel Dashboard:**
1. Go to your project overview page
2. Look for **Domains** section at the top
3. Your production URL is shown (e.g., `taskpilot-xxxxx.vercel.app`)

**This is your working link for Builder Center!**

### 5.2 (Optional) Add Custom Domain

If you want a custom domain like `taskpilot.yourdomain.com`:

1. In Vercel project, go to **Settings** → **Domains**
2. Enter your custom domain
3. Follow DNS configuration instructions from Vercel
4. Wait for DNS propagation (5-60 minutes)

**Use the custom domain as your Builder Center link if configured.**

### 5.3 Final URL Format

Your Builder Center "Working Link" should be one of:

✅ **Vercel subdomain:** `https://taskpilot-xxxxx.vercel.app`

✅ **Custom domain:** `https://taskpilot.yourdomain.com`

❌ **Don't use:** 
- Preview URLs (they expire)
- Lambda URLs (those are backend only)
- Localhost URLs

---

## Step 6: Builder Center Article Checklist

Before submitting your article, verify:

- ✅ App loads without errors
- ✅ Can enter tasks and see prioritized results
- ✅ No CORS errors in browser console
- ✅ Lambda Function URL is set as environment variable in Vercel
- ✅ GitHub repository is public or accessible for review
- ✅ Working link is the production Vercel URL (or custom domain)

**Optional documentation to include in your article:**
- Architecture diagram (Next.js → API Route → Lambda → Bedrock)
- Cost breakdown (Lambda + Bedrock + DynamoDB usage)
- Demo video or screenshots
- Link to GitHub repository

---

## Troubleshooting

### Build Fails on Vercel

**Error:** `Module not found: Can't resolve...`
- Ensure `package.json` has all dependencies
- Run `npm install` locally to verify
- Check for TypeScript errors with `npm run build`

**Error:** `Environment variable AWS_LAMBDA_URL not found`
- Add the environment variable in Vercel Settings
- Redeploy after adding

### Lambda Returns 500 Error

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/TaskPilotPrioritizer --follow --region us-east-1
```

**Common issues:**
- Bedrock model access not enabled (enable in AWS Console → Bedrock → Model Access)
- IAM role missing permissions
- Invalid JSON parsing from Bedrock response

### History Feature Not Working

**Verify DynamoDB table exists:**
```bash
aws dynamodb describe-table \
  --table-name TaskPilotHistory \
  --region us-east-1
```

**Check Lambda has DynamoDB permissions:**
```bash
aws iam list-attached-role-policies \
  --role-name TaskPilotLambdaRole
```

Should include `AmazonDynamoDBFullAccess`.

---

## Summary Commands

**Quick reference for deployment:**

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/taskpilot.git
git push -u origin main

# 2. Import to Vercel (via web UI)
# - Visit vercel.com
# - Import repository
# - Add AWS_LAMBDA_URL environment variable
# - Deploy

# 3. Verify Lambda CORS
aws lambda get-function-url-config \
  --function-name TaskPilotPrioritizer \
  --region us-east-1

# 4. Test deployed app
# - Open https://your-app.vercel.app
# - Enter tasks and click Prioritize
# - Check browser console for errors

# 5. Get final URL for Builder Center
# - Copy production URL from Vercel dashboard
# - Format: https://taskpilot-xxxxx.vercel.app
```

---

## Next Steps

After successful deployment:

1. **Monitor Usage:**
   - Vercel Analytics (if enabled)
   - AWS CloudWatch for Lambda metrics
   - DynamoDB table item count

2. **Optimize Costs:**
   - Review AWS Bedrock usage
   - Check DynamoDB read/write capacity
   - Monitor Lambda invocation count

3. **Enhance Features:**
   - Add user authentication
   - Implement task categories
   - Add export to CSV/PDF
   - Create shareable prioritization links

4. **Write Builder Center Article:**
   - Document your build process
   - Share lessons learned
   - Include architecture decisions
   - Add code snippets and screenshots

---

Good luck with your Builder Center submission! 🚀
