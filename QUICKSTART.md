# TaskPilot - Quick Start Guide

## ✅ Current Status

Your Next.js application is running successfully at:
- **Local:** http://localhost:3000
- **Network:** http://192.168.1.6:3000

## 📋 Next Steps

### 1. Test the Frontend (Without Lambda)

Open http://localhost:3000 in your browser. You should see:
- TaskPilot header
- Task input textarea
- Prioritize button
- View History link

**Note:** The prioritization won't work yet because you need to set up the AWS Lambda backend.

---

### 2. Deploy AWS Lambda Backend

Follow these steps to get the Lambda function running:

#### Step 2.1: Install Lambda Dependencies

```bash
cd lambda
npm install
```

#### Step 2.2: Create IAM Role

```bash
# Create trust policy file
echo {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
} > trust-policy.json

# Create the role
aws iam create-role --role-name TaskPilotLambdaRole --assume-role-policy-document file://trust-policy.json

# Attach policies
aws iam attach-role-policy --role-name TaskPilotLambdaRole --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam attach-role-policy --role-name TaskPilotLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name TaskPilotLambdaRole --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Get role ARN (save this!)
aws iam get-role --role-name TaskPilotLambdaRole --query 'Role.Arn' --output text
```

#### Step 2.3: Package Lambda Function

**Windows (PowerShell):**
```powershell
cd lambda
Compress-Archive -Path index.mjs,node_modules,package.json -DestinationPath function.zip -Force
```

**Linux/Mac:**
```bash
cd lambda
zip -r function.zip index.mjs node_modules package.json
```

#### Step 2.4: Create Lambda Function

Replace `<ROLE-ARN>` with the ARN from step 2.2:

```bash
aws lambda create-function \
  --function-name TaskPilotPrioritizer \
  --runtime nodejs20.x \
  --role <ROLE-ARN> \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --region us-east-1
```

#### Step 2.5: Create Function URL

```bash
# Create Function URL
aws lambda create-function-url-config \
  --function-name TaskPilotPrioritizer \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["POST", "OPTIONS"],
    "AllowHeaders": ["Content-Type"],
    "MaxAge": 86400
  }' \
  --region us-east-1

# Add public invoke permission
aws lambda add-permission \
  --function-name TaskPilotPrioritizer \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1
```

**Save the Function URL from the output!** It will look like: `https://abc123xyz.lambda-url.us-east-1.on.aws/`

#### Step 2.6: (Optional) Create DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name TaskPilotHistory \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

### 3. Configure Lambda URL in Next.js

Edit `.env.local` and replace the placeholder with your actual Lambda URL:

```bash
AWS_LAMBDA_URL=https://your-actual-lambda-url.lambda-url.us-east-1.on.aws/
```

**Restart the Next.js dev server** for changes to take effect:
1. Stop the current server (Ctrl+C in the terminal)
2. Run `npm run dev` again

---

### 4. Enable Bedrock Model Access

Before your Lambda can call Bedrock, you need to enable model access:

1. Go to AWS Console → Amazon Bedrock
2. Click **Model access** in the left sidebar
3. Click **Manage model access**
4. Find **Amazon Nova Micro** and check the box
5. Click **Request model access**
6. Wait 1-2 minutes for approval (usually instant)

---

### 5. Test End-to-End

1. Open http://localhost:3000
2. Enter some test tasks:
   ```
   Fix critical login bug
   Review pull requests
   Update documentation
   Plan Q2 roadmap
   Refactor authentication
   ```
3. Click **Prioritize**
4. Wait 2-3 seconds (first request is slower due to cold start)
5. See ranked tasks with AI-generated reasons

**If you get errors:**
- Check browser console (F12) for CORS errors
- Verify Lambda URL is correct in `.env.local`
- Check CloudWatch Logs for Lambda errors:
  ```bash
  aws logs tail /aws/lambda/TaskPilotPrioritizer --follow --region us-east-1
  ```

---

## 🎯 Current Project Structure

```
aws productivity tool challenge/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── history/             # History API route
│   │   │   └── route.ts
│   │   └── prioritize/          # Main prioritization API
│   │       └── route.ts
│   ├── globals.css              # Tailwind styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main UI component
├── lambda/                       # AWS Lambda function
│   ├── deploy.md                # Detailed deployment guide
│   ├── index.mjs                # Lambda handler
│   └── package.json             # Lambda dependencies
├── .env.local                   # Environment variables (AWS_LAMBDA_URL)
├── package.json                 # Next.js dependencies
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript config
├── DEPLOYMENT.md                # Full deployment guide (Vercel)
├── ARTICLE_CONTENT.md           # Builder Center article content
└── README.md                    # Project overview
```

---

## 🚀 Development Workflow

### Start Development Server
```bash
npm run dev
```
Server runs at http://localhost:3000

### Build for Production
```bash
npm run build
```

### Update Lambda Code
```bash
cd lambda
# Make changes to index.mjs
Compress-Archive -Path index.mjs,node_modules,package.json -DestinationPath function.zip -Force
aws lambda update-function-code --function-name TaskPilotPrioritizer --zip-file fileb://function.zip --region us-east-1
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/TaskPilotPrioritizer --follow --region us-east-1
```

---

## 🐛 Troubleshooting

### "AWS_LAMBDA_URL not configured"
- Check `.env.local` has the correct Lambda URL
- Restart the dev server after editing `.env.local`

### CORS Errors in Browser Console
- Verify Lambda Function URL CORS config:
  ```bash
  aws lambda get-function-url-config --function-name TaskPilotPrioritizer --region us-east-1
  ```
- Should show `AllowOrigins: ["*"]`

### "Failed to prioritize tasks" Error
- Check CloudWatch logs for Lambda errors
- Verify Bedrock model access is enabled
- Test Lambda directly with curl:
  ```bash
  curl -X POST https://YOUR_LAMBDA_URL -H "Content-Type: application/json" -d '{"tasks":"Test task"}'
  ```

### Build Errors
- Check TypeScript errors: `npx tsc --noEmit`
- Check for missing dependencies: `npm install`

---

## 📚 Additional Resources

- **Full Deployment Guide:** See `DEPLOYMENT.md` for Vercel deployment
- **Lambda Details:** See `lambda/deploy.md` for AWS setup
- **Article Content:** See `ARTICLE_CONTENT.md` for Builder Center submission

---

## 🎉 You're Ready!

Your Next.js frontend is running. Follow steps 2-5 above to:
1. Deploy the Lambda backend
2. Enable Bedrock access
3. Connect them together
4. Test the full application

Once everything works locally, follow `DEPLOYMENT.md` to deploy to Vercel!
