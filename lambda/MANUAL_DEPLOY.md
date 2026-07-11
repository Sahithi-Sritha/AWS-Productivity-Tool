# Manual Lambda Deployment Guide

Since AWS CLI is not installed, here's what you need to do:

## Option 1: Install AWS CLI (Recommended)

1. Download AWS CLI for Windows:
   https://awscli.amazonaws.com/AWSCLIV2.msi

2. Run the installer (double-click the .msi file)

3. Open a NEW terminal/PowerShell window

4. Verify installation:
   ```bash
   aws --version
   ```

5. Configure your credentials:
   ```bash
   aws configure
   ```
   - Enter your AWS Access Key ID
   - Enter your AWS Secret Access Key
   - Region: `us-east-1`
   - Format: `json`

6. Then run the deployment script:
   ```bash
   cd "D:\My projects\aws productivity tool challenge\lambda"
   bash deploy-commands.sh
   ```

---

## Option 2: Deploy via AWS Console (Manual)

### Step 1: Create IAM Role

1. Go to: https://console.aws.amazon.com/iam/
2. Click **Roles** (left sidebar)
3. Click **Create role**
4. Select **AWS service** → **Lambda** → Click **Next**
5. Attach these 3 policies (search and check each):
   - `AmazonBedrockFullAccess`
   - `AWSLambdaBasicExecutionRole`
   - `AmazonDynamoDBFullAccess`
6. Click **Next**
7. Role name: `TaskPilotLambdaRole`
8. Click **Create role**

### Step 2: Create Lambda Function

1. Go to: https://console.aws.amazon.com/lambda/
2. Make sure you're in **us-east-1** region (top-right dropdown)
3. Click **Create function**
4. Choose **Author from scratch**
5. Function settings:
   - Function name: `TaskPilotPrioritizer`
   - Runtime: **Node.js 20.x**
   - Architecture: **x86_64**
   - Execution role: **Use an existing role** → Select `TaskPilotLambdaRole`
6. Click **Create function**

### Step 3: Upload Lambda Code

1. In your lambda folder, create a zip file:
   - Select: `index.mjs`, `node_modules` folder, `package.json`
   - Right-click → Send to → Compressed (zipped) folder
   - Name it: `function.zip`

2. In the Lambda console (still on your function page):
   - Scroll to **Code source** section
   - Click **Upload from** → **.zip file**
   - Click **Upload** → Select your `function.zip`
   - Click **Save**

3. Update configuration:
   - Click **Configuration** tab
   - Click **General configuration** → **Edit**
   - Timeout: `30` seconds
   - Memory: `256` MB
   - Click **Save**

### Step 4: Create Function URL

1. Still in Lambda console, click **Configuration** tab
2. Click **Function URL** (left sidebar)
3. Click **Create function URL**
4. Auth type: **NONE**
5. Configure CORS:
   - Check **Configure cross-origin resource sharing (CORS)**
   - Allow origin: `*`
   - Allow methods: `POST, OPTIONS`
   - Allow headers: `Content-Type`
   - Max age: `86400`
6. Click **Save**
7. **COPY THE FUNCTION URL** that appears (e.g., `https://abc123.lambda-url.us-east-1.on.aws/`)

### Step 5: Create DynamoDB Table (Optional)

1. Go to: https://console.aws.amazon.com/dynamodbv2/
2. Click **Create table**
3. Table settings:
   - Table name: `TaskPilotHistory`
   - Partition key: `PK` (String)
   - Sort key: `SK` (String)
4. Table settings:
   - Capacity mode: **On-demand**
5. Click **Create table**

### Step 6: Enable Bedrock Model Access

1. Go to: https://console.aws.amazon.com/bedrock/
2. Click **Model access** (left sidebar)
3. Click **Manage model access** (orange button)
4. Find **Amazon Nova Micro** → Check the box
5. Scroll down → Click **Request model access**
6. Wait 1-2 minutes (usually instant approval)

### Step 7: Update .env.local

1. Open: `D:\My projects\aws productivity tool challenge\.env.local`
2. Replace the placeholder with your Function URL:
   ```
   AWS_LAMBDA_URL=https://your-actual-url.lambda-url.us-east-1.on.aws/
   ```
3. Save the file

### Step 8: Restart Next.js

1. Stop the current dev server (Ctrl+C in terminal)
2. Start it again:
   ```bash
   npm run dev
   ```
3. Open http://localhost:3000
4. Test with some tasks!

---

## Quick Test

Once everything is set up, test your Lambda directly:

### Via AWS Console:
1. Go to your Lambda function
2. Click **Test** tab
3. Event JSON:
   ```json
   {
     "body": "{\"tasks\":\"Fix bug\\nReview code\\nUpdate docs\"}"
   }
   ```
4. Click **Test**
5. Should see prioritized tasks in the response

### Via Browser:
1. Open http://localhost:3000
2. Enter tasks:
   ```
   Fix critical login bug
   Review pull requests
   Update documentation
   ```
3. Click **Prioritize**
4. Should see ranked results in 2-3 seconds

---

## Troubleshooting

### Lambda returns "Model access denied"
- Go back to Bedrock console and verify Nova Micro has a green checkmark

### "Cannot find module" error in Lambda
- Make sure you included the `node_modules` folder in your zip file

### CORS errors in browser
- Check Function URL CORS settings allow `*` origin and `POST` method

### .env.local not updating
- Make sure you restarted the Next.js dev server after editing

---

## Summary

✅ You'll do in AWS Console:
1. Create IAM role with 3 policies
2. Create Lambda function
3. Upload code zip
4. Create Function URL
5. Enable Bedrock access
6. (Optional) Create DynamoDB table

✅ I've already done:
- Created all the code files
- Installed Lambda dependencies (node_modules)
- Created trust-policy.json

✅ You need to update:
- `.env.local` with the Function URL from step 4

After that, your app will work end-to-end!
