# Setup Checklist - What You Need to Configure

## ✅ Prerequisites

Before you start, make sure you have:

1. **AWS Account** 
   - Sign up at https://aws.amazon.com if you don't have one
   - Free tier covers this project's usage

2. **AWS CLI Installed**
   - Download: https://aws.amazon.com/cli/
   - Windows: Download the MSI installer
   - Verify: Run `aws --version` in terminal

3. **AWS CLI Configured with Credentials**
   - This is the ONLY "API key" you need!
   - Run: `aws configure`
   - You'll be asked for:

---

## 🔑 AWS Credentials Setup (The Important Part!)

### Step 1: Get Your AWS Access Keys

1. Go to AWS Console: https://console.aws.amazon.com
2. Click your name (top-right) → **Security credentials**
3. Scroll to **Access keys** section
4. Click **Create access key**
5. Choose **Command Line Interface (CLI)**
6. Check "I understand" and click **Next**
7. Click **Create access key**
8. **SAVE THESE IMMEDIATELY** (you can't see the secret again):
   - Access key ID (looks like: `AKIAIOSFODNN7EXAMPLE`)
   - Secret access key (looks like: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

### Step 2: Configure AWS CLI

Open your terminal and run:

```bash
aws configure
```

It will ask you 4 questions:

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE          ← Paste your access key
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG...  ← Paste your secret key
Default region name [None]: us-east-1                   ← Type this exactly
Default output format [None]: json                      ← Type this exactly
```

**That's it!** Now AWS CLI can deploy your Lambda function.

### Step 3: Test Your AWS Credentials

```bash
aws sts get-caller-identity
```

Should show your AWS account ID and user ARN. If this works, you're good to go!

---

## 📝 Environment Variables You Need

### For Local Development (.env.local)

**File location:** `D:\My projects\aws productivity tool challenge\.env.local`

**What to put in it:**

```env
# This is the ONLY environment variable for Next.js
# You'll get this URL after deploying the Lambda function (Step 2.5 in QUICKSTART.md)
AWS_LAMBDA_URL=https://YOUR_ACTUAL_LAMBDA_URL_HERE.lambda-url.us-east-1.on.aws/
```

**When to update it:**
- After you run the `aws lambda create-function-url-config` command
- The command output will show `"FunctionUrl": "https://..."`
- Copy that entire URL and paste it here

**Example:**
```env
AWS_LAMBDA_URL=https://abc123xyz789.lambda-url.us-east-1.on.aws/
```

---

## 🚫 What You DON'T Need

### ❌ No Bedrock API Keys
- Bedrock uses your AWS credentials automatically
- No separate API key needed

### ❌ No Lambda API Keys
- Lambda Function URLs are public (no auth needed for this project)
- CORS handles browser access

### ❌ No DynamoDB Keys
- Lambda uses IAM role permissions
- No credentials in code

### ❌ No Vercel API Keys (for local dev)
- Only needed when deploying to Vercel
- Vercel handles this automatically during deployment

---

## 📋 Quick Reference: Where Things Go

| What | Where | When |
|------|-------|------|
| **AWS Access Key ID** | AWS CLI config (`aws configure`) | Before deploying Lambda |
| **AWS Secret Key** | AWS CLI config (`aws configure`) | Before deploying Lambda |
| **Lambda Function URL** | `.env.local` file | After creating Lambda Function URL |

---

## 🎯 Step-by-Step Setup Order

### 1. Configure AWS Credentials (ONE TIME)

```bash
aws configure
# Enter your access key, secret key, us-east-1, json
```

### 2. Install Lambda Dependencies

```bash
cd "D:\My projects\aws productivity tool challenge\lambda"
npm install
```

### 3. Deploy Lambda to AWS (uses your AWS credentials)

Follow QUICKSTART.md steps 2.2 through 2.5. Key commands:

```bash
# Create IAM role
aws iam create-role --role-name TaskPilotLambdaRole --assume-role-policy-document file://trust-policy.json

# Attach permissions
aws iam attach-role-policy --role-name TaskPilotLambdaRole --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam attach-role-policy --role-name TaskPilotLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Get role ARN (copy this!)
aws iam get-role --role-name TaskPilotLambdaRole --query 'Role.Arn' --output text

# Package function
Compress-Archive -Path index.mjs,node_modules,package.json -DestinationPath function.zip -Force

# Create Lambda (replace <ROLE-ARN> with the ARN from above)
aws lambda create-function \
  --function-name TaskPilotPrioritizer \
  --runtime nodejs20.x \
  --role <ROLE-ARN> \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region us-east-1

# Create Function URL (SAVE THE URL FROM OUTPUT!)
aws lambda create-function-url-config \
  --function-name TaskPilotPrioritizer \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["POST","OPTIONS"],"AllowHeaders":["Content-Type"],"MaxAge":86400}' \
  --region us-east-1

# Add public access permission
aws lambda add-permission \
  --function-name TaskPilotPrioritizer \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1
```

### 4. Enable Bedrock Model Access (ONE TIME)

**Option A: AWS Console (Easier)**
1. Go to https://console.aws.amazon.com/bedrock
2. Left sidebar → **Model access**
3. Click **Manage model access** (orange button)
4. Find **Amazon Nova Micro** → Check the box
5. Scroll down → Click **Request model access**
6. Wait 1-2 minutes for approval

**Option B: AWS CLI**
```bash
aws bedrock put-model-invocation-logging-configuration \
  --logging-config cloudWatchConfig={logGroupName=/aws/bedrock/modelinvocations,roleArn=arn:aws:iam::YOUR_ACCOUNT_ID:role/service-role/AmazonBedrockExecutionRoleForInvokeModel} \
  --region us-east-1
```

### 5. Update .env.local with Lambda URL

Open `.env.local` and paste the Function URL from step 3:

```env
AWS_LAMBDA_URL=https://the-url-from-step-3.lambda-url.us-east-1.on.aws/
```

### 6. Restart Next.js Dev Server

Stop the current server (Ctrl+C) and restart:

```bash
npm run dev
```

### 7. Test!

1. Open http://localhost:3000
2. Enter tasks:
   ```
   Fix login bug
   Review PRs
   Update docs
   ```
3. Click **Prioritize**
4. Wait 2-3 seconds
5. See ranked results!

---

## 🐛 Common Issues

### "AWS credentials not found"
**Solution:** Run `aws configure` and enter your access key + secret key

### "Access Denied" when running aws commands
**Solution:** 
1. Check your IAM user has permissions (AdministratorAccess or Lambda+Bedrock+IAM+DynamoDB)
2. Verify credentials: `aws sts get-caller-identity`

### "Model access not granted" error from Lambda
**Solution:** Enable Bedrock model access in AWS Console (see Step 4 above)

### "AWS_LAMBDA_URL not configured" in Next.js
**Solution:** 
1. Make sure `.env.local` has the Lambda URL
2. Restart the dev server (`npm run dev`)

### Lambda Function URL not in command output
**Solution:** Get it manually:
```bash
aws lambda get-function-url-config --function-name TaskPilotPrioritizer --region us-east-1
```

---

## 💰 Cost Estimate

With AWS Free Tier, this project costs almost nothing:

- **Lambda:** 1M requests/month free (you'll use ~100)
- **Bedrock Nova Micro:** ~$0.0005 per prioritization
- **DynamoDB:** 25GB storage + 25 WCU free
- **CloudWatch Logs:** 5GB free

**Expected monthly cost:** < $1 for testing and demo purposes

---

## 🎉 Summary

**You ONLY need:**
1. ✅ AWS Access Key ID + Secret Key (from AWS Console → Security credentials)
2. ✅ Run `aws configure` once
3. ✅ Deploy Lambda with the AWS CLI commands
4. ✅ Copy the Lambda Function URL to `.env.local`
5. ✅ Enable Bedrock model access (one-time)
6. ✅ Restart your dev server

**No other API keys, tokens, or secrets needed!**

---

## 📞 Need Help?

If you get stuck:
1. Check CloudWatch Logs: `aws logs tail /aws/lambda/TaskPilotPrioritizer --follow --region us-east-1`
2. Test Lambda directly: `curl -X POST https://YOUR_LAMBDA_URL -H "Content-Type: application/json" -d '{"tasks":"test"}'`
3. Verify AWS credentials: `aws sts get-caller-identity`
4. Check browser console (F12) for frontend errors
